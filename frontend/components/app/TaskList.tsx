'use client'

import { useTaskDoneCelebration } from '@/hooks/useTaskDoneCelebration'
import type { Task, TaskStatus } from '@/lib/types'
import { TaskDoneBurst } from './TaskDoneBurst'
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
  /** Today’s first packet task — surfaced as “start here”. */
  startHereTaskId?: string | null
}

export function TaskList({
  tasks,
  onChangeStatus,
  onEditTitle,
  onDelete,
  startHereTaskId,
}: Props) {
  const { completingId, celebrateId, submitStatus } = useTaskDoneCelebration()

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: tasks.filter((t) => t.status === status),
  }))

  return (
    <div className="space-y-8">
      {grouped.map(({ status, items }) => (
        <section key={status}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {LABELS[status]}
          </h3>
          {items.length === 0 ? (
            <p className="text-sm text-[var(--color-text-faint)]">Nothing here.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((task) => (
                <li
                  key={task.id}
                  className={`panel-card flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between ${
                    startHereTaskId === task.id
                      ? 'ring-2 ring-sky-500/50 ring-offset-2 ring-offset-[var(--color-bg-deep)]'
                      : ''
                  } ${
                    celebrateId === task.id && task.status === 'done' ? 'task-row-celebrate' : ''
                  } ${
                    completingId === task.id && task.status !== 'done' ? 'task-row-completing' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    {startHereTaskId === task.id && (
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                        Start here
                      </span>
                    )}
                    <input
                      className="w-full bg-transparent text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-faint)]"
                      value={task.title}
                      onChange={(e) => onEditTitle(task.id, e.target.value)}
                      aria-label="Task title"
                    />
                  </div>
                  <div className="relative flex min-h-[2.25rem] flex-wrap items-center gap-2 sm:justify-end">
                    {completingId === task.id && task.status !== 'done' && <TaskDoneBurst />}
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
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs text-rose-300/90 hover:bg-rose-500/10"
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
