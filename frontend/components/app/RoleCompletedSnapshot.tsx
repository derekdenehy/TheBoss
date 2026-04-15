'use client'

import { useMemo, useState } from 'react'
import { useAppState } from '@/context/AppStateContext'
import { tasksCompletedOnLocalDay } from '@/lib/calendarDay'
import { getTodayKey } from '@/lib/dailyBoss'

type Scope = 'day' | 'session'

type Props = { roleId: string }

/**
 * Completions for this role only: **Today** = local calendar day of `completedAt`;
 * **Active session** = completions during this role’s current clock-in (same as clock-out summary).
 */
export function RoleCompletedSnapshot({ roleId }: Props) {
  const { getTasksForRole, getActiveSessionForRole, tasksCompletedDuringSession } = useAppState()
  const todayYmd = getTodayKey()
  const [scope, setScope] = useState<Scope>('day')

  const roleTasks = useMemo(() => getTasksForRole(roleId), [getTasksForRole, roleId])

  const dayTasks = useMemo(() => {
    const list = tasksCompletedOnLocalDay(roleTasks, todayYmd)
    return [...list].sort(
      (a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
    )
  }, [roleTasks, todayYmd])

  const sessionHere = getActiveSessionForRole(roleId)
  const sessionTasks = useMemo(
    () => (sessionHere ? tasksCompletedDuringSession(sessionHere) : []),
    [sessionHere, tasksCompletedDuringSession]
  )

  const rows = scope === 'day' ? dayTasks : sessionTasks

  return (
    <section
      className="panel-card mt-8 border-emerald-500/15 bg-emerald-500/[0.04] p-4"
      aria-label="Completed tasks for this role"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Completed</h2>
        <div
          className="flex rounded-lg border border-white/10 bg-[var(--color-bg-deep)]/80 p-0.5 text-xs font-medium"
          role="group"
          aria-label="Completion scope"
        >
          <button
            type="button"
            onClick={() => setScope('day')}
            className={`rounded-md px-2.5 py-1 transition ${
              scope === 'day'
                ? 'bg-emerald-500/25 text-emerald-100'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Today ({todayYmd})
          </button>
          <button
            type="button"
            onClick={() => setScope('session')}
            className={`rounded-md px-2.5 py-1 transition ${
              scope === 'session'
                ? 'bg-emerald-500/25 text-emerald-100'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Active session
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-[var(--color-text-faint)]">
        {scope === 'day' ? (
          <>
            Tasks for this role marked done today (local date of{' '}
            <span className="text-[var(--color-text-muted)]">completed</span> time).
          </>
        ) : (
          <>
            Tasks completed while <strong className="font-medium text-[var(--color-text-muted)]">clocked in</strong> to
            this role — same list as the summary when you clock out.
          </>
        )}
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          {scope === 'day'
            ? 'Nothing completed today yet for this role.'
            : sessionHere
              ? 'Nothing completed during this clock-in yet.'
              : 'Clock in to track completions for this session.'}
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5 text-sm text-[var(--color-text-primary)]">
          {rows.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-white/[0.06] bg-[var(--color-bg-deep)]/40 px-2.5 py-1.5 font-medium"
            >
              {t.title.trim() || 'Untitled'}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
