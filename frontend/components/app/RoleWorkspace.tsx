'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { formatCoins } from '@/lib/earnings'
import { getTodayKey } from '@/lib/dailyBoss'
import { useAppState } from '@/context/AppStateContext'
import type { Session } from '@/lib/types'
import { CurrencyBadge } from './CurrencyBadge'
import { SessionSummaryModal } from './SessionSummaryModal'
import { SessionTimer } from './SessionTimer'
import { TaskList } from './TaskList'

type Props = { roleId: string }

export function RoleWorkspace({ roleId }: Props) {
  const router = useRouter()
  const {
    hydrated,
    getRoleById,
    getTasksForRole,
    updateTask,
    deleteTask,
    addTask,
    clockIn,
    clockOut,
    getActiveSessionForRole,
    liveElapsedSecondsForRole,
    liveSessionEarningsForRole,
    liveTotalCurrency,
    tasksCompletedDuringSession,
    deleteRole,
    updateRole,
    todayBossRoutine,
  } = useAppState()

  const [newTitle, setNewTitle] = useState('')
  const [nameEdit, setNameEdit] = useState('')
  const [summarySession, setSummarySession] = useState<Session | null>(null)

  const role = getRoleById(roleId)
  const todayKey = getTodayKey()

  useEffect(() => {
    if (role) setNameEdit(role.name)
  }, [role?.id, role?.name])

  const tasks = useMemo(() => {
    const list = getTasksForRole(roleId)
    return [...list].sort((a, b) => {
      const aP = a.briefingMeta?.date === todayKey
      const bP = b.briefingMeta?.date === todayKey
      if (aP !== bP) return aP ? -1 : 1
      if (aP && bP && a.briefingMeta && b.briefingMeta) {
        return a.briefingMeta.order - b.briefingMeta.order
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  }, [getTasksForRole, roleId, todayKey])

  const bossBriefing =
    todayBossRoutine?.committedAt &&
    todayBossRoutine.activeRoleIds.includes(roleId) &&
    todayBossRoutine.date === todayKey

  const startHereTaskId = useMemo(() => {
    const candidates = tasks.filter(
      (t) => t.briefingMeta?.date === todayKey && t.status !== 'done'
    )
    if (candidates.length === 0) return null
    return [...candidates].sort(
      (a, b) => (a.briefingMeta!.order) - (b.briefingMeta!.order)
    )[0]?.id ?? null
  }, [tasks, todayKey])
  const sessionHere = getActiveSessionForRole(roleId)
  const clockedHere = !!sessionHere

  const handleClockToggle = () => {
    if (clockedHere) {
      const ended = clockOut(roleId)
      if (ended) setSummarySession(ended)
      return
    }
    clockIn(roleId)
  }

  const commitRoleName = () => {
    if (!role) return
    const next = nameEdit.trim()
    if (next === role.name) return
    if (!next) {
      setNameEdit(role.name)
      return
    }
    const ok = updateRole(roleId, { name: next })
    if (!ok) {
      setNameEdit(role.name)
      window.alert('Could not rename: choose a unique name.')
    }
  }

  const handleDeleteRole = () => {
    if (!role) return
    const ok = window.confirm(
      `Delete "${role.name}" and all of its tasks? This cannot be undone.`
    )
    if (!ok) return
    deleteRole(role.id)
    router.push('/boss')
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-[var(--color-text-muted)]">
        Loading…
      </div>
    )
  }

  if (!role) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-lg text-[var(--color-text-primary)]">Role not found.</p>
        <Link href="/boss" className="mt-4 inline-block text-sky-400 hover:underline">
          ← Boss workspace
        </Link>
      </div>
    )
  }

  const accent = role.color || '#38bdf8'

  return (
    <div className="mx-auto max-w-2xl pb-20">
      <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
        <CurrencyBadge amount={liveTotalCurrency()} />
      </div>

      <header
        className="panel-card p-6"
        style={{ borderColor: `${accent}44` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Role mode
            </p>
            <div className="mt-2 flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl"
                style={{ backgroundColor: `${accent}22`, color: accent }}
              >
                {role.icon || '◆'}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                  <input
                    className="w-full max-w-xl bg-transparent text-2xl font-bold text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-faint)] focus:ring-2 focus:ring-sky-500/35 rounded-md -mx-1 px-1"
                    value={nameEdit}
                    onChange={(e) => setNameEdit(e.target.value)}
                    onBlur={commitRoleName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        ;(e.target as HTMLInputElement).blur()
                      }
                      if (e.key === 'Escape') {
                        setNameEdit(role.name)
                        ;(e.target as HTMLInputElement).blur()
                      }
                    }}
                    aria-label="Role name"
                    spellCheck={false}
                  />
                </h1>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {role.hourlyRate} coins/hour while clocked in
                </p>
              </div>
            </div>
          </div>
        </div>

        {clockedHere && (
          <div className="mt-6 grid gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-200/80">Session time</p>
              <SessionTimer seconds={liveElapsedSecondsForRole(roleId)} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-200/80">This session</p>
              <p className="font-mono text-lg text-amber-200">
                🪙 {formatCoins(liveSessionEarningsForRole(roleId))}
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleClockToggle}
          className={`mt-6 w-full rounded-2xl py-4 text-base font-bold transition ${
            clockedHere
              ? 'bg-rose-500/90 text-white hover:bg-rose-400'
              : 'bg-emerald-500/90 text-slate-950 hover:bg-emerald-400'
          }`}
        >
          {clockedHere ? 'Clock out' : 'Clock in'}
        </button>
      </header>

      {bossBriefing && todayBossRoutine && (
        <section
          className="mt-8 rounded-2xl border border-sky-500/25 bg-sky-500/10 px-5 py-5 text-sm"
          style={{ borderColor: `${accent}55` }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-200/90">
            Today&apos;s briefing
          </p>
          {todayBossRoutine.outcomes.filter((o) => o.trim()).length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
                Day outcomes
              </p>
              <ul className="mt-1 list-inside list-disc text-[var(--color-text-primary)]">
                {todayBossRoutine.outcomes
                  .map((o) => o.trim())
                  .filter(Boolean)
                  .map((o, i) => (
                    <li key={`${i}-${o}`}>{o}</li>
                  ))}
              </ul>
            </div>
          )}
          {todayBossRoutine.rolePackets[roleId]?.frictionNote?.trim() && (
            <div className="mt-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
                Friction removed
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[var(--color-text-primary)]">
                {todayBossRoutine.rolePackets[roleId].frictionNote}
              </p>
            </div>
          )}
          {todayBossRoutine.switchConditions[roleId]?.trim() && (
            <div className="mt-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-faint)]">
                Switch conditions
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[var(--color-text-muted)]">
                {todayBossRoutine.switchConditions[roleId]}
              </p>
            </div>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Tasks
        </h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            addTask(roleId, newTitle)
            setNewTitle('')
          }}
        >
          <input
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[var(--color-bg-panel)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
            placeholder="Quick add a task…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-sky-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
          >
            Add
          </button>
        </form>

        <div className="mt-8">
          {tasks.length === 0 ? (
            <div className="panel-card p-6 text-center text-sm text-[var(--color-text-muted)]">
              Add one to three small tasks—then clock in and work through them.
            </div>
          ) : (
            <TaskList
              tasks={tasks}
              startHereTaskId={bossBriefing ? startHereTaskId : null}
              onChangeStatus={(id, status) => updateTask(id, { status })}
              onEditTitle={(id, title) => updateTask(id, { title })}
              onDelete={(id) => deleteTask(id)}
              onAddSubtask={(parentId, title) => addTask(roleId, title, { parentTaskId: parentId })}
            />
          )}
        </div>
      </section>

      <div className="mt-12 border-t border-white/[0.06] pt-8">
        <button
          type="button"
          onClick={handleDeleteRole}
          className="text-sm text-rose-400/90 hover:underline"
        >
          Delete this role…
        </button>
      </div>

      <SessionSummaryModal
        open={!!summarySession}
        session={summarySession}
        role={summarySession ? getRoleById(summarySession.roleId) : undefined}
        completedTasks={summarySession ? tasksCompletedDuringSession(summarySession) : []}
        onClose={() => setSummarySession(null)}
      />
    </div>
  )
}
