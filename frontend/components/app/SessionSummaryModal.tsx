'use client'

import { useEffect, useMemo, useRef } from 'react'
import { formatCoins, formatDuration } from '@/lib/earnings'
import type { Role, Session, Task } from '@/lib/types'

type Props = {
  open: boolean
  session: Session | null
  role: Role | undefined
  completedTasks: Task[]
  onClose: () => void
}

function seedFromString(s: string): number {
  let h = 1779033703 ^ s.length
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CONFETTI_COLORS = [
  'rgba(251, 191, 36, 0.95)',
  'rgba(52, 211, 153, 0.9)',
  'rgba(125, 211, 252, 0.9)',
  'rgba(196, 181, 253, 0.9)',
  'rgba(251, 113, 133, 0.85)',
  'rgba(254, 240, 138, 0.9)',
]

function runFlavor(count: number): { headline: string; sub: string } {
  if (count <= 0) return { headline: 'Session logged', sub: 'Stack a clear next run — clock in when you’re ready.' }
  if (count === 1) return { headline: 'Objective cleared', sub: 'Solo clear. That counts.' }
  if (count <= 4) return { headline: 'Nice chain', sub: `${count} objectives down. Keep the tempo.` }
  return { headline: 'Legendary run', sub: `${count} objectives cleared. That’s a session worth saving.` }
}

export function SessionSummaryModal({
  open,
  session,
  role,
  completedTasks,
  onClose,
}: Props) {
  const accent = role?.color || '#38bdf8'
  const continueRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    continueRef.current?.focus({ preventScroll: true })
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const confetti = useMemo(() => {
    if (!session) return []
    const rnd = mulberry32(seedFromString(session.id))
    const n = 20
    return Array.from({ length: n }, (_, i) => {
      const left = rnd() * 100
      const drift = (rnd() - 0.5) * 220
      const rot = 360 + rnd() * 540
      const duration = 2.2 + rnd() * 1.6
      const delay = rnd() * 0.35 + i * 0.02
      const size = 4 + rnd() * 5
      const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
      return { left, drift, rot, duration, delay, size, color, i }
    })
  }, [session])

  if (!open || !session) return null

  const duration = session.durationSeconds ?? 0
  const earnings = session.earnings ?? 0
  const n = completedTasks.length
  const flavor = runFlavor(n)
  const xpPct = Math.min(100, Math.round(14 + n * 16 + Math.min(duration / 60, 1) * 8))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-summary-title"
    >
      <button
        type="button"
        className="session-reward-backdrop absolute inset-0 z-0 bg-black/80 backdrop-blur-md"
        aria-label="Close session summary"
        onClick={onClose}
      />

      <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
        {confetti.map((c) => (
          <span
            key={c.i}
            className="session-reward-confetti-piece absolute top-0 rounded-sm shadow-sm"
            style={{
              left: `${c.left}%`,
              width: c.size,
              height: c.size * 0.55,
              background: c.color,
              boxShadow: `0 0 10px ${c.color}`,
              ['--session-cx' as string]: `${c.drift}px`,
              ['--session-cr' as string]: `${c.rot}deg`,
              ['--session-cd' as string]: `${c.duration}s`,
              ['--session-cdel' as string]: `${c.delay}s`,
            }}
          />
        ))}
      </div>

      <div
        className="session-reward-modal-shell panel-card relative z-10 max-h-[min(90vh,720px)] w-full max-w-lg overflow-hidden border-2 p-0 shadow-[0_0_60px_rgba(0,0,0,0.55)] sm:max-w-xl"
        style={{
          borderColor: `${accent}55`,
          boxShadow: `0 0 0 1px ${accent}22, 0 24px 80px rgba(0,0,0,0.65), 0 0 100px color-mix(in srgb, ${accent} 18%, transparent)`,
        }}
      >
        <div
          className="session-reward-glow-orb pointer-events-none absolute -top-24 left-1/2 h-72 w-[120%] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
          style={{
            background: `radial-gradient(ellipse at center, color-mix(in srgb, ${accent} 45%, transparent) 0%, transparent 65%)`,
          }}
          aria-hidden
        />

        <div
          className="session-reward-shine pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[inherit]"
          aria-hidden
        >
          <div
            className="h-full w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent"
            style={{ width: '55%' }}
          />
        </div>

        <div className="relative z-10 max-h-[min(90vh,720px)] overflow-y-auto px-5 py-7 sm:px-8 sm:py-8">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.38em] text-amber-200/95">
            Mission complete
          </p>
          <h2
            id="session-summary-title"
            className="mt-3 text-center text-2xl font-black tracking-tight text-transparent sm:text-3xl"
            style={{
              backgroundImage: `linear-gradient(135deg, #fef3c7 0%, #a7f3d0 35%, #bae6fd 70%, color-mix(in srgb, ${accent} 90%, white) 100%)`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
            }}
          >
            {flavor.headline}
          </h2>
          <p className="mt-1 text-center text-sm font-semibold text-[var(--color-text-primary)]">
            {role?.name ?? 'Role'}
          </p>
          <p className="mx-auto mt-2 max-w-md text-center text-xs leading-relaxed text-[var(--color-text-muted)]">
            {flavor.sub}
          </p>

          <div className="mx-auto mt-5 max-w-sm">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-faint)]">
              <span>Focus meter</span>
              <span className="tabular-nums text-amber-200/90">{xpPct}%</span>
            </div>
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10">
              <div
                className="session-reward-xp-inner h-full rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-sky-400 shadow-[0_0_16px_rgba(52,211,153,0.45)]"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div
              className="session-reward-stat-tile rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-center sm:py-3.5"
              style={{ animationDelay: '0.12s' }}
            >
              <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-faint)]">
                Time in run
              </p>
              <p className="mt-1 font-mono text-base font-bold tabular-nums text-sky-200 sm:text-lg">
                {formatDuration(duration)}
              </p>
            </div>
            <div
              className="session-reward-stat-tile rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-center sm:py-3.5"
              style={{ animationDelay: '0.22s' }}
            >
              <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-faint)]">
                Loot
              </p>
              <p className="mt-1 font-mono text-base font-bold tabular-nums text-emerald-200 sm:text-lg">
                +{formatCoins(earnings)}
              </p>
            </div>
            <div
              className="session-reward-stat-tile col-span-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-3 text-center sm:col-span-1 sm:py-3.5"
              style={{ animationDelay: '0.32s' }}
            >
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-200/80">
                Objectives cleared
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-emerald-100 sm:text-3xl">{n}</p>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-200/85">
              Cleared this session
            </p>
            {n === 0 ? (
              <p className="mt-4 text-center text-sm text-[var(--color-text-muted)]">
                No tasks completed during this clock-in. Next run is a fresh board.
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5" aria-label="Tasks completed this session">
                {completedTasks.map((t, i) => (
                  <li
                    key={t.id}
                    className="session-reward-quest-row flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.12] via-emerald-500/[0.06] to-transparent px-3.5 py-3 sm:px-4"
                    style={{ animationDelay: `${0.42 + i * 0.11}s` }}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/25 text-base text-emerald-200 shadow-inner ring-1 ring-emerald-400/30"
                      aria-hidden
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-[var(--color-text-primary)]">
                      {t.title.trim() || 'Untitled'}
                    </span>
                    <span className="shrink-0 rounded-md bg-emerald-950/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300/95">
                      Clear
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="text-center text-xs text-[var(--color-text-muted)]">
              <span className="text-amber-200/80" aria-hidden>
                ★
              </span>{' '}
              Steady focus stacks into real progress.
            </p>
            <button
              ref={continueRef}
              type="button"
              className="w-full max-w-sm rounded-xl bg-gradient-to-r from-sky-500 via-emerald-500 to-emerald-600 py-3.5 text-sm font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-emerald-900/30 transition hover:brightness-110 active:scale-[0.99]"
              onClick={onClose}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
