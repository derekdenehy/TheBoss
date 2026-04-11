'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppState } from '@/context/AppStateContext'
import type { ChatTurn } from '@/lib/boss-ai/callModel'
import type { AIContext } from '@/lib/types'
import { emptyAIContext } from '@/lib/types'

type Step = 'roles' | 'goals' | 'project' | 'done'

type Config = { configured: boolean; provider: 'anthropic' | 'openai' | null }

export function ConversationalOnboarding() {
  const router = useRouter()
  const {
    aiContext,
    setAIContext,
    setAIContextSetupComplete,
    roles,
    addRole,
  } = useAppState()

  const [config, setConfig] = useState<Config | null>(null)
  const [step, setStep] = useState<Step>('roles')
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bootstrapped = useRef(false)

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const res = await fetch('/api/boss/chat')
        const data = (await res.json()) as Config
        if (!c) setConfig(data)
      } catch {
        if (!c) setConfig({ configured: false, provider: null })
      }
    })()
    return () => {
      c = true
    }
  }, [])

  const workspaceRoleNames = roles.map((r) => r.name)

  const applyServerResult = useCallback(
    (data: {
      message: string
      mergedContext: AIContext
      nextStep: string
      finishOnboarding: boolean
    }) => {
      setAIContext(data.mergedContext)
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message }])
      const ns = data.nextStep as Step
      if (ns === 'roles' || ns === 'goals' || ns === 'project' || ns === 'done') {
        setStep(ns)
      }
      if (data.finishOnboarding) {
        const seen = new Set(roles.map((r) => r.name.trim().toLowerCase()))
        for (const label of data.mergedContext.profile.roles) {
          const name = label.trim()
          if (!name) continue
          const key = name.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)
          addRole({ name })
        }
        setAIContextSetupComplete(true)
        router.push('/boss')
      }
    },
    [addRole, roles, router, setAIContext, setAIContextSetupComplete]
  )

  const callOnboarding = useCallback(
    async (payload: {
      bootstrap?: boolean
      step: Step
      messages: ChatTurn[]
      draft: typeof aiContext
    }) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/boss/onboarding', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            workspaceRoleNames,
          }),
        })
        const data = (await res.json()) as {
          message?: string
          mergedContext?: AIContext
          nextStep?: string
          finishOnboarding?: boolean
          error?: string
        }
        if (!res.ok) {
          setError(data.error ?? `Request failed (${res.status})`)
          return
        }
        if (!data.message || !data.mergedContext) {
          setError('Invalid response')
          return
        }
        applyServerResult({
          message: data.message,
          mergedContext: data.mergedContext,
          nextStep: data.nextStep ?? payload.step,
          finishOnboarding: !!data.finishOnboarding,
        })
      } catch {
        setError('Network error')
      } finally {
        setLoading(false)
      }
    },
    [applyServerResult, workspaceRoleNames]
  )

  useEffect(() => {
    if (config?.configured !== true || bootstrapped.current) return
    bootstrapped.current = true
    void callOnboarding({
      bootstrap: true,
      step: 'roles',
      messages: [],
      draft: aiContext,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once when AI is ready
  }, [config?.configured])

  const send = useCallback(() => {
    const text = draft.trim()
    if (!text || loading || config?.configured !== true) return
    setDraft('')
    const userMsg = { role: 'user' as const, content: text }
    const nextMsgs: ChatTurn[] = [...messages, userMsg]
    setMessages(nextMsgs)
    void callOnboarding({
      step,
      messages: nextMsgs,
      draft: aiContext,
    })
  }, [aiContext, callOnboarding, config?.configured, draft, loading, messages, step])

  const skip = useCallback(() => {
    setAIContext(emptyAIContext())
    setAIContextSetupComplete(true)
    router.push('/boss')
  }, [router, setAIContext, setAIContextSetupComplete])

  if (config === null) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--color-text-muted)]">
        Loading…
      </div>
    )
  }

  if (!config.configured) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-20">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/80">
            Step 1 · Your context
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">
            Chat onboarding needs an API key
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Add <code className="rounded bg-white/10 px-1 text-xs">ANTHROPIC_API_KEY</code> or{' '}
            <code className="rounded bg-white/10 px-1 text-xs">OPENAI_API_KEY</code> to{' '}
            <code className="rounded bg-white/10 px-1 text-xs">frontend/.env.local</code>, restart{' '}
            <code className="rounded bg-white/10 px-1 text-xs">npm run dev</code>, then refresh this page.
          </p>
        </header>
        <button
          type="button"
          onClick={skip}
          className="text-sm text-[var(--color-text-faint)] underline-offset-4 hover:text-[var(--color-text-muted)] hover:underline"
        >
          Skip and enter Boss without context
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/80">
          Step 1 · Build your context
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">
          Boss will ask a few focused questions
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          We start by defining the <strong className="font-medium text-[var(--color-text-primary)]">roles</strong>{' '}
          you switch between — not a vague &quot;what are you working on&quot;. Goals and a concrete project come
          next. Task style, warm-ups, and blockers are optional and get picked up over time in Focus, not here.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">
        <span className={step === 'roles' ? 'text-sky-300' : ''}>Roles</span>
        <span>→</span>
        <span className={step === 'goals' ? 'text-sky-300' : ''}>Goals</span>
        <span>→</span>
        <span className={step === 'project' ? 'text-sky-300' : ''}>Project</span>
        <span>→</span>
        <span className={step === 'done' ? 'text-sky-300' : ''}>Done</span>
      </div>

      <div className="min-h-[280px] space-y-3 overflow-y-auto rounded-xl border border-white/[0.06] bg-[var(--color-bg-deep)]/40 p-4">
        {messages.length === 0 && loading && (
          <p className="text-sm text-[var(--color-text-faint)] animate-pulse">Boss is thinking…</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'ml-6 bg-sky-500/15 text-[var(--color-text-primary)]'
                : 'mr-6 bg-white/[0.05] text-[var(--color-text-muted)]'
            }`}
          >
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
              {m.role === 'user' ? 'You' : 'Boss'}
            </span>
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
        {loading && messages.length > 0 && (
          <p className="text-xs text-[var(--color-text-faint)] animate-pulse">Thinking…</p>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200/90">
          {error}
        </p>
      )}

      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[var(--color-bg-panel)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
          placeholder="Reply to Boss…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={loading}
          aria-label="Onboarding reply"
        />
        <button
          type="submit"
          disabled={loading || !draft.trim()}
          className="rounded-xl bg-sky-500/90 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-40"
        >
          Send
        </button>
      </form>

      <p className="mt-8 text-center text-xs text-[var(--color-text-faint)]">
        <button type="button" onClick={skip} className="hover:text-[var(--color-text-muted)] hover:underline">
          Skip — enter Boss without finishing chat
        </button>
        {' · '}
        <Link href="/" className="hover:text-[var(--color-text-muted)] hover:underline">
          ← Progress
        </Link>
      </p>
    </div>
  )
}
