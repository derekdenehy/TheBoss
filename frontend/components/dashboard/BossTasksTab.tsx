'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { TaskDuration } from '@/components/app/TaskDuration'
import { TaskDoneBurst } from '@/components/app/TaskDoneBurst'
import { useAppState } from '@/context/AppStateContext'
import { useTaskDoneCelebration } from '@/hooks/useTaskDoneCelebration'
import type { TaskStatus } from '@/lib/types'

export function BossTasksTab() {
  const { tasks, roles, getRoleById, updateTask } = useAppState()
  const { completingId, celebrateId, submitStatus } = useTaskDoneCelebration()
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [q, setQ] = useState('')

  const sortedRoles = useMemo(
    () => [...roles].sort((a, b) => a.name.localeCompare(b.name)),
    [roles]
  )

  const rows = useMemo(() => {
    let list = [...tasks]
    if (roleFilter) list = list.filter((t) => t.roleId === roleFilter)
    const qq = q.trim().toLowerCase()
    if (qq) list = list.filter((t) => t.title.toLowerCase().includes(qq))
    list.sort((a, b) => {
      const da = a.dueAt ?? '9999'
      const db = b.dueAt ?? '9999'
      if (da !== db) return da.localeCompare(db)
      return a.title.localeCompare(b.title)
    })
    return list
  }, [tasks, roleFilter, q])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search tasks…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[12rem] flex-1 rounded-xl border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
        >
          <option value="">All roles</option>
          {sortedRoles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="panel-card py-12 text-center text-sm text-[var(--color-text-muted)]">
          No tasks match.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/[0.06] bg-[var(--color-bg-panel)]/60 text-xs uppercase tracking-wider text-[var(--color-text-faint)]">
              <tr>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rows.map((t) => {
                const role = getRoleById(t.roleId)
                return (
                  <tr
                    key={t.id}
                    className={`hover:bg-white/[0.02] ${
                      celebrateId === t.id && t.status === 'done' ? 'task-row-celebrate' : ''
                    } ${completingId === t.id && t.status !== 'done' ? 'task-row-completing' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/boss/role/${t.roleId}`}
                        className="font-medium text-[var(--color-text-primary)] hover:text-sky-300"
                      >
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">
                      {role?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        value={t.dueAt ?? ''}
                        onChange={(e) => updateTask(t.id, { dueAt: e.target.value })}
                        className="rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <TaskDuration task={t} />
                    </td>
                    <td className="relative px-4 py-3 align-middle">
                      <div className="relative inline-flex min-h-[2.25rem] min-w-[7rem] items-center">
                        {completingId === t.id && t.status !== 'done' && (
                          <TaskDoneBurst className="task-done-burst--table" />
                        )}
                        <select
                          value={t.status}
                          onChange={(e) =>
                            submitStatus(t.id, e.target.value as TaskStatus, (id, status) =>
                              updateTask(id, { status })
                            )
                          }
                          className="relative z-[1] rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none"
                        >
                        <option value="todo">To do</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
