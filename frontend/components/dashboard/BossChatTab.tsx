'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppState } from '@/context/AppStateContext'
import { parseBossAssistantReply, resolveRoleIdForTask } from '@/lib/bossChatActions'
import { tasksToPromptRows } from '@/lib/calendarDay'
import { getTodayKey } from '@/lib/dailyBoss'

type Turn = { role: 'user' | 'assistant'; content: string }

type Config = { configured: boolean }

const STARTER_PROMPTS: { label: string; text: string }[] = [
  {
    label: 'Add a todo',
    text: 'Add a todo for me: describe it in one sentence, pick the role it belongs to from my sidebar names, and confirm once it should exist on my list.',
  },
  {
    label: 'Next move',
    text: 'Given my working state and goals, what is the single best thing I should do next? Give one primary recommendation and at most two backups.',
  },
  {
    label: 'Unblock',
    text: 'Pick the most important blocked item in my context and suggest the smallest concrete next step to unblock it, phrased in my preferred task style.',
  },
  {
    label: 'Today’s shape',
    text: 'In 5 bullets, describe how today should feel and flow given my goals, blockers, and warm-up preference — no new tasks, just orientation.',
  },
]

export function BossChatTab() {
  const {
    aiContext,
    calendarEvents,
    tasks,
    roles,
    getRoleById,
    supabaseConfigured,
    authUser,
    addTask,
    getActiveSessions,
  } = useAppState()
  const todayYmd = getTodayKey()
  const taskDueRows = useMemo(
    () => tasksToPromptRows(tasks, (id) => getRoleById(id)?.name ?? 'Role'),
    [tasks, getRoleById]
  )
  const [config, setConfig] = useState<Config | null>(null)
  const [messages, setMessages] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [captureNote, setCaptureNote] = useState<{ ok: string[]; err: string[] } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/boss/chat')
        const data = (await res.json()) as Config
        if (!cancelled) setConfig(data)
      } catch {
        if (!cancelled) setConfig({ configured: false })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const hasThread = messages.length > 0 || loading

  useEffect(() => {
    if (!hasThread) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, hasThread])

  const postMessages = useCallback(
    async (nextMessages: Turn[]) => {
      setError(null)
      setCaptureNote(null)
      setLoading(true)
      try {
        const res = await fetch('/api/boss/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            messages: nextMessages,
            aiContext,
            calendarEvents,
            todayLocalDate: todayYmd,
            taskDueRows,
            roles: roles.map((r) => ({ name: r.name })),
          }),
        })
        const data = (await res.json()) as { reply?: string; error?: string }
        if (!res.ok) {
          setError(data.error ?? `Request failed (${res.status})`)
          return
        }
        if (!data.reply) {
          setError('Empty response')
          return
        }
        const { visibleText, createTasks } = parseBossAssistantReply(data.reply)
        const preferRoleId = getActiveSessions()[0]?.roleId ?? null
        const ok: string[] = []
        const err: string[] = []
        for (const c of createTasks) {
          const hit = resolveRoleIdForTask(roles, c.roleName, preferRoleId)
          if (!hit) {
            err.push(
              `No role matched for “${c.title}”${c.roleName.trim() ? ` (“${c.roleName.trim()}”)` : ''}. Use a role name from your sidebar.`
            )
            continue
          }
          addTask(hit.roleId, c.title, c.dueAt ? { dueAt: c.dueAt } : undefined)
          ok.push(`Added “${c.title}” to ${hit.role.name}`)
        }
        if (ok.length || err.length) setCaptureNote({ ok, err })

        const assistantContent =
          visibleText.trim() ||
          (ok.length > 0 ? 'Done.' : err.length > 0 ? 'I could not file that on a role yet.' : '')

        setMessages([
          ...nextMessages,
          ...(assistantContent
            ? ([{ role: 'assistant', content: assistantContent }] as Turn[])
            : []),
        ])
      } catch {
        setError('Network error')
      } finally {
        setLoading(false)
      }
    },
    [
      aiContext,
      calendarEvents,
      todayYmd,
      taskDueRows,
      roles,
      addTask,
      getActiveSessions,
    ]
  )

  const sendWithText = useCallback(
    (text: string) => {
      const t = text.trim()
      if (!t || loading) return
      const nextMessages: Turn[] = [...messages, { role: 'user', content: t }]
      setMessages(nextMessages)
      void postMessages(nextMessages)
    },
    [loading, messages, postMessages]
  )

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const t = draft.trim()
      if (!t || loading) return
      setDraft('')
      sendWithText(t)
    },
    [draft, loading, sendWithText]
  )

  if (supabaseConfigured && !authUser) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-6 text-center">
        <div className="space-y-2">
          <p className="text-base font-semibold text-[var(--color-text-primary)]">
            Sign in to use Chat
          </p>
          <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
            Your setup is saved on this device. Sign in to talk to Boss and keep everything synced.
          </p>
        </div>
        <Link
          href="/login"
          className="rounded-xl bg-sky-500/90 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
        >
          Sign in
        </Link>
        <p className="text-xs text-[var(--color-text-faint)]">
          No account yet?{' '}
          <Link href="/login" className="text-sky-400/80 hover:text-sky-300 hover:underline">
            Create one free
          </Link>
        </p>
      </div>
    )
  }

  if (config === null) {
    return (
      <div className="text-sm text-[var(--color-text-muted)]">Checking AI configuration…</div>
    )
  }

  if (!config.configured) {
    return (
      <div className="max-w-xl space-y-4 rounded-2xl border border-white/[0.08] bg-[var(--color-bg-panel)]/50 p-6 text-sm text-[var(--color-text-muted)]">
        <p className="font-medium text-[var(--color-text-primary)]">Chat needs an API key</p>
        <p>
          Add a server-side key to{' '}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">frontend/.env.local</code> and
          restart <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">npm run dev</code>:
        </p>
        <ul className="list-inside list-disc space-y-2 text-[var(--color-text-muted)]">
          <li>
            <strong className="text-[var(--color-text-primary)]">Claude:</strong>{' '}
            <code className="text-xs">ANTHROPIC_API_KEY=...</code>
          </li>
          <li>
            <strong className="text-[var(--color-text-primary)]">OpenAI:</strong>{' '}
            <code className="text-xs">OPENAI_API_KEY=...</code>
          </li>
          <li>
            Both set? Use <code className="text-xs">BOSS_AI_PROVIDER=openai</code> to force OpenAI.
          </li>
        </ul>
        <p>
          <Link href="/boss/context" className="text-sky-400 hover:underline">
            Context &amp; onboarding
          </Link>{' '}
          — add a key when you&apos;re ready.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {hasThread && (
        <div className="max-h-[min(52vh,520px)] space-y-3 overflow-y-auto rounded-xl border border-white/[0.06] bg-[var(--color-bg-deep)]/40 p-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-lg px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'ml-2 bg-sky-500/15 text-[var(--color-text-primary)] sm:ml-8'
                  : 'mr-2 bg-white/[0.05] text-[var(--color-text-muted)] sm:mr-8'
              }`}
            >
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
                {m.role === 'user' ? 'You' : 'Boss'}
              </span>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          ))}
          {loading && (
            <p className="text-xs text-[var(--color-text-faint)] animate-pulse">Thinking…</p>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {captureNote && (captureNote.ok.length > 0 || captureNote.err.length > 0) && (
        <div className="space-y-1 rounded-lg border border-white/[0.06] bg-[var(--color-bg-panel)]/50 px-3 py-2 text-xs">
          {captureNote.ok.map((s, i) => (
            <p key={`ok-${i}`} className="text-emerald-200/90">
              {s}
            </p>
          ))}
          {captureNote.err.map((s, i) => (
            <p key={`er-${i}`} className="text-amber-200/90">
              {s}
            </p>
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200/90">
          {error}
        </p>
      )}

      <form className="flex flex-wrap gap-2" onSubmit={onSubmit}>
        <input
          id="boss-dash-chat-input"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[var(--color-bg-panel)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
          placeholder="Message Boss… (e.g. add a todo: call Alex this week — under Work)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={loading}
          aria-label="Message Boss"
        />
        <button
          type="submit"
          disabled={loading || !draft.trim()}
          className="rounded-xl bg-sky-500/90 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
        {messages.length > 0 && (
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setMessages([])
              setError(null)
              setCaptureNote(null)
            }}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-[var(--color-text-muted)] hover:bg-white/[0.04]"
          >
            Clear
          </button>
        )}
      </form>

      {messages.length === 0 && !loading && (
        <div className="flex flex-wrap gap-2">
          {STARTER_PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={loading}
              onClick={() => sendWithText(p.text)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-left text-xs font-medium text-[var(--color-text-primary)] transition hover:border-sky-500/35 hover:bg-sky-500/10 disabled:opacity-40"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
