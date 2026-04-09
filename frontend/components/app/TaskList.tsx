'use client'

import { useState } from 'react'
import { useTaskDoneCelebration } from '@/hooks/useTaskDoneCelebration'
import { orderTasksForStatusColumn } from '@/lib/taskTree'
import type { Task, TaskStatus } from '@/lib/types'
import { TaskDuration } from './TaskDuration'

const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'done']

const LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

type Props = {
  tasks: Task[]
  onChangeStatus: (id: string, status: TaskStatus) => void
  onEditTitle: (id: string, title: string) => void
  onDelete: (id: string) => void
  onAddSubtask: (parentId: string, title: string) => void
  /** Today’s first packet task — surfaced as “start here”. */
  startHereTaskId?: string | null
}

export function TaskList({
  tasks,
  onChangeStatus,
  onEditTitle,
  onDelete,
  onAddSubtask,
  startHereTaskId,
}: Props) {
  const { celebrateId, submitStatus } = useTaskDoneCelebration()
  const [subtaskParentId, setSubtaskParentId] = useState<string | null>(null)
  const [subtaskDraft, setSubtaskDraft] = useState('')

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    rows: orderTasksForStatusColumn(tasks, status),
  }))

  return (
    <div className="space-y-8">
      {grouped.map(({ status, rows }) => (
        <section key={status}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {LABELS[status]}
          </h3>
          {rows.length === 0 ? (
            <p className="text-sm text-[var(--color-text-faint)]">Nothing here.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map(({ task, depth, subRowHint }) => (
                <li
                  key={task.id}
                  className={`panel-card flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between ${
                    startHereTaskId === task.id
                      ? 'ring-2 ring-sky-500/50 ring-offset-2 ring-offset-[var(--color-bg-deep)]'
                      : ''
                  } ${
                    celebrateId === task.id && task.status === 'done' ? 'task-row-celebrate' : ''
                  }`}
                  style={{
                    marginLeft: depth > 0 ? Math.min(depth, 8) * 14 : undefined,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    {startHereTaskId === task.id && (
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                        Start here
                      </span>
                    )}
                    {subRowHint && (
                      <p className="mb-1 text-[10px] text-[var(--color-text-faint)]">{subRowHint}</p>
                    )}
                    <input
                      className="w-full bg-transparent text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-faint)]"
                      value={task.title}
                      onChange={(e) => onEditTitle(task.id, e.target.value)}
                      aria-label="Task title"
                    />
                    {subtaskParentId === task.id && (
                      <form
                        className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-2"
                        onSubmit={(e) => {
                          e.preventDefault()
                          const v = subtaskDraft.trim()
                          if (!v) return
                          onAddSubtask(task.id, v)
                          setSubtaskDraft('')
                          setSubtaskParentId(null)
                        }}
                      >
                        <input
                          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
                          placeholder="New subtask…"
                          value={subtaskDraft}
                          onChange={(e) => setSubtaskDraft(e.target.value)}
                          autoFocus
                          aria-label="New subtask title"
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-sky-500/80 px-2 py-1 text-xs font-medium text-slate-950 hover:bg-sky-400"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          className="rounded-lg px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-white/[0.04]"
                          onClick={() => {
                            setSubtaskParentId(null)
                            setSubtaskDraft('')
                          }}
                        >
                          Cancel
                        </button>
                      </form>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <TaskDuration task={task} className="min-w-[3rem] text-right" />
                    <select
                      className="rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none"
                      value={task.status}
                      onChange={(e) =>
                        submitStatus(task.id, e.target.value as TaskStatus, onChangeStatus)
                      }
                      aria-label="Task status"
                    >
                      <option value="todo">To do</option>
                      <option value="in_progress">In progress</option>
                      <option value="done">Done</option>
                    </select>
                    {subtaskParentId !== task.id && (
                      <button
                        type="button"
                        className="rounded-lg px-2 py-1 text-xs text-sky-300/90 hover:bg-sky-500/10"
                        onClick={() => {
                          setSubtaskParentId(task.id)
                          setSubtaskDraft('')
                        }}
                      >
                        + Subtask
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs text-rose-300/90 hover:bg-rose-500/10"
                      title="Deletes this task and all of its subtasks"
                      onClick={() => onDelete(task.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
