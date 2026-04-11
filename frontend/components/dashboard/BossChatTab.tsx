'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppState } from '@/context/AppStateContext'

type Turn = { role: 'user' | 'assistant'; content: string }

type Config = { configured: boolean; provider: 'anthropic' | 'openai' | null }

const STARTER_PROMPTS: { label: string; text: string }[] = [
  {
    label: 'Next move',
    text: 'Given my working state and goals, what is the single best thing I should do next? Give one primary recommendation and at most two backups.',
  },
  {
    label: 'Urgent vs important',
    text: 'Compare my urgent list to my main goal and current priority. What should I stop treating as urgent, or what am I neglecting that actually matters?',
  },
  {
    label: 'Unblock',
    text: 'Pick the most important blocked item in my context and suggest the smallest concrete next step to unblock it, phrased in my preferred task style.',
  },
  {
    label: 'Avoidance',
    text: 'What am I avoiding that still aligns with my goals? Name it kindly and suggest one tiny entry point.',
  },
  {
    label: 'Today’s shape',
    text: 'In 5 bullets, describe how today should feel and flow given my goals, blockers, and warm-up preference — no new tasks, just orientation.',
  },
]

type Props = {
  onOpenBrief?: () => void
}

export function BossChatTab({ onOpenBrief }: Props) {
  const { aiContext } = useAppState()
  const [config, setConfig] = useState<Config | null>(null)
  const [messages, setMessages] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/boss/chat')
        const data = (await res.json()) as Config
        if (!cancelled) setConfig(data)
      } catch {
        if (!cancelled) setConfig({ configured: false, provider: null })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const postMessages = useCallback(
    async (nextMessages: Turn[]) => {
      setError(null)
      setLoading(true)
      try {
        const res = await fetch('/api/boss/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messages: nextMessages, aiContext }),
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
        setMessages([...nextMessages, { role: 'assistant', content: data.reply }])
      } catch {
        setError('Network error')
      } finally {
        setLoading(false)
      }
    },
    [aiContext]
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

  const ws = aiContext.workingState
  const wsCounts =
    ws.inProgress.length + ws.urgent.length + ws.blocked.length + ws.avoiding.length

  if (config === null) {
    return (
      <div className="text-sm text-[var(--color-text-muted)]">Checking AI configuration…</div>
    )
  }

  if (!config.configured) {
    return (
      <div className="max-w-xl space-y-4 rounded-2xl border border-white/[0.08] bg-[var(--color-bg-panel)]/50 p-6 text-sm text-[var(--color-text-muted)]">
        <p className="font-medium text-[var(--color-text-primary)]">Focus needs an API key</p>
        <p>
          Add a server-side key to <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">frontend/.env.local</code> and restart{' '}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">npm run dev</code>:
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
            AI Studio
          </Link>{' '}
          still saves your brief; wire a key when you&apos;re ready to orchestrate with the model.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(200px,260px)_minmax(0,1fr)] lg:items-start">
      <aside className="space-y-4 rounded-xl border border-white/[0.06] bg-[var(--color-bg-panel)]/40 p-4 text-xs lg:sticky lg:top-4">
        <div>
          <p className="font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
            Context snapshot
          </p>
          <p className="mt-2 text-[var(--color-text-muted)]">
            The model reads your brief in order:{' '}
            <span className="text-[var(--color-text-primary)]">now → goals → projects → style</span>.
          </p>
        </div>
        <div className="space-y-2 rounded-lg border border-white/[0.06] bg-[var(--color-bg-deep)]/50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-200/80">
            Working state ({wsCounts} lines)
          </p>
          <ul className="space-y-1 text-[var(--color-text-muted)]">
            <li>In progress: {ws.inProgress.length ? ws.inProgress[0] : '—'}</li>
            <li>Urgent: {ws.urgent.length ? ws.urgent[0] : '—'}</li>
            <li>Blocked: {ws.blocked.length ? ws.blocked[0] : '—'}</li>
            <li>Avoiding: {ws.avoiding.length ? ws.avoiding[0] : '—'}</li>
          </ul>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-[var(--color-bg-deep)]/50 p-3 text-[var(--color-text-muted)]">
          <p className="text-[10px] font-semibold uppercase text-sky-200/80">Goals</p>
          <p className="mt-1 text-[var(--color-text-primary)]">
            {aiContext.goals.mainGoal.trim() || '—'}
          </p>
          {aiContext.goals.currentPriority.trim() && (
            <p className="mt-1 text-[var(--color-text-faint)]">{aiContext.goals.currentPriority}</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href="/boss/context"
            className="rounded-lg border border-white/10 py-2 text-center text-sky-300/90 hover:bg-white/[0.04]"
          >
            Edit AI Studio
          </Link>
          {onOpenBrief && (
            <button
              type="button"
              onClick={onOpenBrief}
              className="rounded-lg border border-white/10 py-2 text-center text-[var(--color-text-muted)] hover:bg-white/[0.04]"
            >
              Open full Brief
            </button>
          )}
        </div>
        <p className="text-[10px] text-[var(--color-text-faint)]">
          Provider: {config.provider === 'anthropic' ? 'Claude' : 'OpenAI'}
        </p>
      </aside>

      <div className="flex min-h-[min(72vh,760px)] flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            What do you want to move?
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Boss uses your saved context only — no extra memory. Start with a prompt below or type your
            own.
          </p>
        </div>

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

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-white/[0.06] bg-[var(--color-bg-deep)]/40 p-4">
          {messages.length === 0 && !loading && (
            <p className="text-sm text-[var(--color-text-faint)]">
              Your structured brief (working state, goals, projects, profile) is sent with every
              message — same fields as in the{' '}
              <button
                type="button"
                onClick={onOpenBrief}
                className="font-medium text-sky-400/90 underline-offset-2 hover:underline disabled:opacity-50"
                disabled={!onOpenBrief}
              >
                Brief
              </button>{' '}
              tab.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-lg px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'ml-4 bg-sky-500/15 text-[var(--color-text-primary)] sm:ml-8'
                  : 'mr-4 bg-white/[0.05] text-[var(--color-text-muted)] sm:mr-8'
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

        {error && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200/90">
            {error}
          </p>
        )}

        <form className="flex flex-wrap gap-2" onSubmit={onSubmit}>
          <input
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[var(--color-bg-panel)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
            placeholder="Ask Boss to orchestrate your next step…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={loading}
            aria-label="Chat message"
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
              }}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-[var(--color-text-muted)] hover:bg-white/[0.04]"
            >
              Clear
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
