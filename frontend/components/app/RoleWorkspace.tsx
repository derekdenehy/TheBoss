'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { formatCoins } from '@/lib/earnings'
import { getTodayKey } from '@/lib/dailyBoss'
import { useAppState } from '@/context/AppStateContext'
import {
  effectiveWorkspaceBlocks,
  finalizeWorkspaceBlocksForSave,
} from '@/lib/roleWorkspaceBlocks'
import { orderTasksForStatusColumn } from '@/lib/taskTree'
import type { RoleWorkspaceBlock, Session } from '@/lib/types'
import { InProgressModularWorkspace } from './InProgressModularWorkspace'
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

  const inProgressRootTasks = useMemo(
    () => tasks.filter((t) => t.status === 'in_progress' && !t.parentTaskId),
    [tasks]
  )

  const inProgressPrimaryTitle = useMemo(() => {
    const rows = orderTasksForStatusColumn(tasks, 'in_progress')
    if (rows.length === 0) return null
    const startTask =
      startHereTaskId &&
      tasks.find((t) => t.id === startHereTaskId && t.status === 'in_progress')
    if (startTask) return startTask.title
    const roots = rows.filter((r) => r.depth === 0)
    if (roots.length === 1) return roots[0].task.title
    if (roots.length > 1) {
      const t0 = roots[0].task.title
      return roots.length === 2 ? `${t0} · +1 other` : `${t0} · +${roots.length - 1} others`
    }
    return rows[0].task.title
  }, [tasks, startHereTaskId])

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

  const workspaceBlocks = useMemo(() => effectiveWorkspaceBlocks(role), [role])

  const handleWorkspaceBlocks = (next: RoleWorkspaceBlock[]) => {
    updateRole(roleId, {
      workspaceBlocks: finalizeWorkspaceBlocksForSave(next),
      workspaceNotes: '',
      workspaceResourceLinks: [],
    })
  }

  const stepHint =
    inProgressRootTasks.length === 1
      ? 'Nests under your current top-level focus.'
      : inProgressRootTasks.length > 1
        ? 'Top-level in progress (several focuses).'
        : 'Creates an in-progress task; use + Subtask on a row for splits.'

  const inProgressWorkspace = (
    <InProgressModularWorkspace
      blocks={workspaceBlocks}
      onUpdateBlocks={handleWorkspaceBlocks}
      onAddInProgressStep={(title) => {
        const parentId =
          inProgressRootTasks.length === 1 ? inProgressRootTasks[0].id : undefined
        addTask(roleId, title, { status: 'in_progress', parentTaskId: parentId })
      }}
      stepHint={stepHint}
    />
  )

  return (
    <div className="mx-auto max-w-3xl pb-20">
      <header
        className="panel-card px-3 py-2.5 sm:px-4"
        style={{ borderColor: `${accent}44` }}
      >
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base sm:h-10 sm:w-10 sm:text-lg"
            style={{ backgroundColor: `${accent}22`, color: accent }}
          >
            {role.icon || '◆'}
          </div>
          <div className="min-w-0 flex-1">
            <input
              className="w-full max-w-md bg-transparent text-base font-semibold text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-faint)] focus:ring-2 focus:ring-sky-500/30 rounded-md -mx-0.5 px-0.5 sm:text-lg"
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
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {role.hourlyRate} / hr · role mode
            </p>
          </div>
          <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:ml-auto sm:w-auto">
            {clockedHere && (
              <div className="mr-auto flex flex-wrap items-baseline gap-x-3 gap-y-0.5 sm:mr-0 sm:gap-x-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-emerald-200/70">
                    Time
                  </span>
                  <SessionTimer
                    seconds={liveElapsedSecondsForRole(roleId)}
                    className="font-mono text-sm tabular-nums text-emerald-200 sm:text-base"
                  />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-amber-200/70">
                    Session
                  </span>
                  <span className="font-mono text-sm tabular-nums text-amber-200">
                    {formatCoins(liveSessionEarningsForRole(roleId))}
                  </span>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={handleClockToggle}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition sm:px-4 ${
                clockedHere
                  ? 'bg-rose-500/90 text-white hover:bg-rose-400'
                  : 'bg-emerald-500/90 text-slate-950 hover:bg-emerald-400'
              }`}
            >
              {clockedHere ? 'Clock out' : 'Clock in'}
            </button>
          </div>
        </div>
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
          {tasks.length === 0 && (
            <p className="mb-4 text-sm text-[var(--color-text-muted)]">
              Queue work in <strong className="text-[var(--color-text-primary)]">To do</strong>, or add
              steps in <strong className="text-[var(--color-text-primary)]">In progress</strong> above.
            </p>
          )}
          <TaskList
            tasks={tasks}
            startHereTaskId={bossBriefing ? startHereTaskId : null}
            inProgressPrimaryTitle={inProgressPrimaryTitle}
            inProgressWorkspace={inProgressWorkspace}
            onChangeStatus={(id, status) => updateTask(id, { status })}
            onEditTitle={(id, title) => updateTask(id, { title })}
            onDelete={(id) => deleteTask(id)}
            onAddSubtask={(parentId, title) => addTask(roleId, title, { parentTaskId: parentId })}
          />
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
