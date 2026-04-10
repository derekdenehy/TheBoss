'use client'

import { formatCoins, formatDuration } from '@/lib/earnings'
import type { Role, Session, Task } from '@/lib/types'

type Props = {
  open: boolean
  session: Session | null
  role: Role | undefined
  completedTasks: Task[]
  onClose: () => void
}

export function SessionSummaryModal({
  open,
  session,
  role,
  completedTasks,
  onClose,
}: Props) {
  if (!open || !session) return null

  const duration = session.durationSeconds ?? 0
  const earnings = session.earnings ?? 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-summary-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="panel-card relative z-10 max-w-md w-full p-6 shadow-2xl">
        <h2 id="session-summary-title" className="text-xl font-bold text-[var(--color-text-primary)]">
          Session complete
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {role?.name ?? 'Role'}
        </p>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--color-text-muted)]">Time focused</dt>
            <dd className="font-mono text-[var(--color-text-primary)]">{formatDuration(duration)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--color-text-muted)]">Earned this session</dt>
            <dd className="font-semibold text-emerald-200">💲 {formatCoins(earnings)} dollars</dd>
          </div>
        </dl>

        {completedTasks.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Tasks done
            </p>
            <ul className="mt-2 space-y-1.5">
              {completedTasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm text-emerald-200/90">
                  <span aria-hidden>✓</span>
                  <span>{t.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-6 text-sm text-[var(--color-text-muted)]">
          Nice work. Steady focus adds up.
        </p>

        <button
          type="button"
          className="mt-6 w-full rounded-xl bg-sky-500/90 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          onClick={onClose}
        >
          Back to it
        </button>
      </div>
    </div>
  )
}
