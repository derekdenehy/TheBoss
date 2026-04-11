'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAppState } from '@/context/AppStateContext'

export function ProgressLanding() {
  const { hydrated, northStar, updateNorthStar, aiContextSetupComplete } = useAppState()
  const [editing, setEditing] = useState(false)
  const [draftLabel, setDraftLabel] = useState('')
  const [draftValue, setDraftValue] = useState('')

  useEffect(() => {
    if (editing) {
      setDraftLabel(northStar.label)
      setDraftValue(northStar.value === null ? '' : String(northStar.value))
    }
  }, [editing, northStar.label, northStar.value])

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--color-text-muted)]">
        Loading…
      </div>
    )
  }

  const saveEdit = () => {
    const raw = draftValue.trim()
    const n = raw === '' ? null : Number(raw)
    updateNorthStar({
      label: draftLabel.trim(),
      value: n !== null && !Number.isNaN(n) ? n : null,
    })
    setEditing(false)
  }

  const displayLabel =
    northStar.label.trim() || 'The number that sums your success'

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-20">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_0%,rgba(56,189,248,0.08),transparent_55%)]" />
      <div className="relative z-10 w-full max-w-lg text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-400/80">
          Progress
        </p>
        <h1 className="mt-4 text-5xl font-semibold tabular-nums tracking-tight text-[var(--color-text-primary)] sm:text-6xl">
          {northStar.value === null ? '—' : northStar.value.toLocaleString()}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
          {displayLabel}
        </p>

        <div className="mt-12 flex flex-col items-center gap-4">
          <Link
            href={aiContextSetupComplete ? '/boss' : '/boss/context'}
            className="inline-flex items-center justify-center rounded-2xl bg-sky-500/90 px-8 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            {aiContextSetupComplete ? 'Enter Boss' : 'Set up Boss (context first)'}
          </Link>
          {!aiContextSetupComplete && (
            <p className="max-w-sm text-center text-xs text-[var(--color-text-faint)]">
              First time: a short form builds your profile, goals, and project so Focus and Chat can
              help you decide what to do.
            </p>
          )}
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-[var(--color-text-faint)] underline-offset-4 transition hover:text-[var(--color-text-muted)] hover:underline"
            >
              Set what you measure
            </button>
          )}
        </div>

        {editing && (
          <div className="mt-10 w-full space-y-3 rounded-2xl border border-white/[0.06] bg-[var(--color-bg-panel)]/80 p-5 text-left">
            <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Label
            </label>
            <input
              className="w-full rounded-xl border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              placeholder="e.g. Daily active users (gym app)"
            />
            <label className="mt-2 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Today&apos;s number
            </label>
            <input
              type="number"
              min={0}
              className="w-full rounded-xl border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              placeholder="Leave empty until you have it"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-white/15"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
