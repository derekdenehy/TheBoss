'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppState } from '@/context/AppStateContext'
import type { ChatTurn } from '@/lib/boss-ai/callModel'
import type { AIContext } from '@/lib/types'
import { emptyAIContext } from '@/lib/types'

type Step = 'dump' | 'clarify' | 'roles' | 'confirm' | 'rates' | 'done'

type RoleDetail = { name: string; hourlyRate: number; color: string }

type Config = { configured: boolean; provider: 'anthropic' | 'openai' | null }

const PRESET_COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#4ade80', '#fb923c']

// ---------------------------------------------------------------------------
// RatesStep — interactive role cards shown when step === 'rates'
// ---------------------------------------------------------------------------
function RatesStep({
  initialRoles,
  onConfirm,
  disabled,
}: {
  initialRoles: string[]
  onConfirm: (details: RoleDetail[]) => void
  disabled: boolean
}) {
  const [details, setDetails] = useState<RoleDetail[]>(() =>
    initialRoles.map((name, i) => ({
      name,
      hourlyRate: 20,
      color: PRESET_COLORS[i % PRESET_COLORS.length],
    }))
  )

  const adjust = (i: number, delta: number) =>
    setDetails((prev) =>
      prev.map((d, idx) =>
        idx === i ? { ...d, hourlyRate: Math.max(0, Math.round(d.hourlyRate + delta)) } : d
      )
    )

  const setName = (i: number, val: string) =>
    setDetails((prev) => prev.map((d, idx) => (idx === i ? { ...d, name: val } : d)))

  const setRate = (i: number, val: string) => {
    const n = parseInt(val, 10)
    if (!isNaN(n) && n >= 0)
      setDetails((prev) => prev.map((d, idx) => (idx === i ? { ...d, hourlyRate: n } : d)))
  }

  if (details.length === 0) return null

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-xl border border-white/[0.06] bg-[var(--color-bg-deep)]/40 p-4">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
          Boss
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">
          Each role is a job title — when you clock in, you&apos;re doing the work that professional does.
          Set what an hour of that work is worth to you.
        </p>

        <div className="mt-4 space-y-2">
          {details.map((d, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[var(--color-bg-panel)]/60 px-4 py-3"
            >
              {/* Color dot */}
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: d.color }}
              />

              {/* Editable role name */}
              <input
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-faint)]"
                value={d.name}
                onChange={(e) => setName(i, e.target.value)}
                disabled={disabled}
                aria-label={`Role name ${i + 1}`}
              />

              {/* Rate stepper */}
              <div className="flex items-center gap-1.5 text-sm">
                <button
                  type="button"
                  onClick={() => adjust(i, -5)}
                  disabled={disabled || d.hourlyRate <= 0}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-[var(--color-text-muted)] transition hover:bg-white/[0.06] disabled:opacity-30"
                  aria-label="Decrease rate"
                >
                  −
                </button>
                <div className="flex items-center gap-0.5 text-[var(--color-text-primary)]">
                  <span className="text-xs text-[var(--color-text-faint)]">$</span>
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={d.hourlyRate}
                    onChange={(e) => setRate(i, e.target.value)}
                    disabled={disabled}
                    className="w-12 bg-transparent text-center text-sm font-medium outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    aria-label={`Hourly rate for ${d.name}`}
                  />
                  <span className="text-xs text-[var(--color-text-faint)]">/hr</span>
                </div>
                <button
                  type="button"
                  onClick={() => adjust(i, 5)}
                  disabled={disabled}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-[var(--color-text-muted)] transition hover:bg-white/[0.06] disabled:opacity-30"
                  aria-label="Increase rate"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onConfirm(details)}
          disabled={disabled}
          className="mt-4 w-full rounded-xl bg-sky-500/90 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-40"
        >
          {disabled ? 'Setting up…' : 'Looks good'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main onboarding component
// ---------------------------------------------------------------------------
export function ConversationalOnboarding() {
  const router = useRouter()
  const { aiContext, setAIContext, setAIContextSetupComplete, roles, addRole } = useAppState()

  const [config, setConfig] = useState<Config | null>(null)
  const [step, setStep] = useState<Step>('dump')
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bootstrapped = useRef(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Holds rate cards data so we can create roles when finishOnboarding fires
  const pendingRoleDetailsRef = useRef<RoleDetail[] | null>(null)

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
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, step])

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [])

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
      if (
        ns === 'dump' || ns === 'clarify' || ns === 'roles' ||
        ns === 'confirm' || ns === 'rates' || ns === 'done'
      ) {
        setStep(ns)
      }
      if (data.finishOnboarding) {
        const details = pendingRoleDetailsRef.current
        const seen = new Set(roles.map((r) => r.name.trim().toLowerCase()))
        if (details?.length) {
          for (const rd of details) {
            const name = rd.name.trim()
            if (!name) continue
            const key = name.toLowerCase()
            if (seen.has(key)) continue
            seen.add(key)
            addRole({ name, hourlyRate: rd.hourlyRate, color: rd.color })
          }
        } else {
          // Fallback if rates UI was skipped
          for (const label of data.mergedContext.profile.roles) {
            const name = label.trim()
            if (!name) continue
            const key = name.toLowerCase()
            if (seen.has(key)) continue
            seen.add(key)
            addRole({ name })
          }
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
          body: JSON.stringify(payload),
        })
        const data = (await res.json()) as {
          message?: string
          mergedContext?: AIContext
          nextStep?: string
          finishOnboarding?: boolean
          error?: string
        }
        if (!res.ok) {
          const raw = data.error ?? ''
          const friendly =
            res.status === 429
              ? 'Too many requests — try again in a moment.'
              : res.status === 503
              ? 'AI not configured. Add an API key to frontend/.env.local.'
              : res.status === 502
              ? 'The AI is busy right now — try again in a few seconds.'
              : raw || `Request failed (${res.status})`
          setError(friendly)
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
    [applyServerResult]
  )

  useEffect(() => {
    if (config?.configured !== true || bootstrapped.current) return
    bootstrapped.current = true
    void callOnboarding({ bootstrap: true, step: 'dump', messages: [], draft: aiContext })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.configured])

  const send = useCallback(() => {
    const text = draft.trim()
    if (!text || loading || config?.configured !== true) return
    setDraft('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    const userMsg = { role: 'user' as const, content: text }
    const nextMsgs: ChatTurn[] = [...messages, userMsg]
    setMessages(nextMsgs)
    void callOnboarding({ step, messages: nextMsgs, draft: aiContext })
  }, [aiContext, callOnboarding, config?.configured, draft, loading, messages, step])

  // Called when user clicks "Looks good" on the rates cards
  const handleRatesConfirm = useCallback(
    (details: RoleDetail[]) => {
      pendingRoleDetailsRef.current = details
      // Build a readable summary for the AI to reference in its closing message
      const summary = details
        .map((d) => `${d.name.trim() || 'Role'}: $${d.hourlyRate}/hr`)
        .join(', ')
      const userMsg = { role: 'user' as const, content: summary }
      const nextMsgs: ChatTurn[] = [...messages, userMsg]
      setMessages(nextMsgs)
      void callOnboarding({ step: 'rates', messages: nextMsgs, draft: aiContext })
    },
    [aiContext, callOnboarding, messages]
  )

  const skip = useCallback(() => {
    setAIContext(emptyAIContext())
    setAIContextSetupComplete(true)
    router.push('/boss')
  }, [router, setAIContext, setAIContextSetupComplete])

  // -------------------------------------------------------------------------
  // Guards
  // -------------------------------------------------------------------------
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
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          Boss needs an API key to get started
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Add{' '}
          <code className="rounded bg-white/10 px-1 text-xs">ANTHROPIC_API_KEY</code> or{' '}
          <code className="rounded bg-white/10 px-1 text-xs">OPENAI_API_KEY</code> to{' '}
          <code className="rounded bg-white/10 px-1 text-xs">frontend/.env.local</code>, restart{' '}
          <code className="rounded bg-white/10 px-1 text-xs">npm run dev</code>, then refresh.
        </p>
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

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------
  const showRatesUI = step === 'rates' && aiContext.profile.roles.length > 0

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          Let&apos;s get you oriented
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Boss will ask a couple of questions. No forms. Just tell it what&apos;s on your mind.
        </p>
      </header>

      {/* Chat messages */}
      <div className="min-h-[280px] space-y-3 overflow-y-auto rounded-xl border border-white/[0.06] bg-[var(--color-bg-deep)]/40 p-4">
        {messages.length === 0 && loading && (
          <p className="animate-pulse text-sm text-[var(--color-text-faint)]">Boss is thinking…</p>
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
          <p className="animate-pulse text-xs text-[var(--color-text-faint)]">Thinking…</p>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200/90">
          {error}
        </p>
      )}

      {/* Rates UI — replaces textarea when roles are ready to price */}
      {showRatesUI ? (
        <RatesStep
          initialRoles={aiContext.profile.roles}
          onConfirm={handleRatesConfirm}
          disabled={loading}
        />
      ) : (
        <form
          className="mt-4 flex flex-col gap-2"
          onSubmit={(e) => { e.preventDefault(); send() }}
        >
          <textarea
            ref={textareaRef}
            rows={3}
            className="w-full resize-none rounded-xl border border-white/10 bg-[var(--color-bg-panel)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
            placeholder={
              step === 'dump'
                ? "Just get it all out — don't organize it…"
                : step === 'confirm'
                ? "Add any missing roles or say 'looks good'…"
                : 'Reply to Boss…'
            }
            value={draft}
            onChange={(e) => { setDraft(e.target.value); resizeTextarea() }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                send()
              }
            }}
            disabled={loading}
            aria-label="Onboarding reply"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-[var(--color-text-faint)]">Ctrl+Enter to send</span>
            <div className="flex items-center gap-2">
              {step === 'confirm' && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setDraft('')
                    const userMsg = { role: 'user' as const, content: "Looks good" }
                    const nextMsgs = [...messages, userMsg]
                    setMessages(nextMsgs)
                    void callOnboarding({ step, messages: nextMsgs, draft: aiContext })
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="2 7 5.5 10.5 12 3.5" />
                  </svg>
                  All good
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !draft.trim()}
                className="rounded-xl bg-sky-500/90 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        </form>
      )}

      <p className="mt-8 text-center text-xs text-[var(--color-text-faint)]">
        <button
          type="button"
          onClick={skip}
          className="hover:text-[var(--color-text-muted)] hover:underline"
        >
          Skip — enter Boss without finishing
        </button>
        {' · '}
        <Link href="/" className="hover:text-[var(--color-text-muted)] hover:underline">
          ← Progress
        </Link>
      </p>
    </div>
  )
}
