'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useTaskDoneCelebration } from '@/hooks/useTaskDoneCelebration'
import { orderTasksForStatusColumn } from '@/lib/taskTree'
import type { Task, TaskStatus } from '@/lib/types'
import { TaskDuration } from './TaskDuration'

/** Natural flow: queue → focus → archive. */
const DISPLAY_ORDER: TaskStatus[] = ['todo', 'in_progress', 'done']

const LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Completed',
}

const COLLAPSE_DONE_THRESHOLD = 5

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M5 10.2 8.4 13.6 15.2 6.8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type Props = {
  tasks: Task[]
  onChangeStatus: (id: string, status: TaskStatus) => void
  onEditTitle: (id: string, title: string) => void
  onDelete: (id: string) => void
  onAddSubtask: (parentId: string, title: string) => void
  /** Today’s first packet task — surfaced as “start here”. */
  startHereTaskId?: string | null
  /** Primary focus title shown beside the In progress heading. */
  inProgressPrimaryTitle?: string | null
  /** Modular workspace (notes / links / files) above the in-progress task list. */
  inProgressWorkspace?: ReactNode
}

export function TaskList({
  tasks,
  onChangeStatus,
  onEditTitle,
  onDelete,
  onAddSubtask,
  startHereTaskId,
  inProgressPrimaryTitle,
  inProgressWorkspace,
}: Props) {
  const { completingId, celebrateId, submitStatus } = useTaskDoneCelebration()
  const [subtaskParentId, setSubtaskParentId] = useState<string | null>(null)
  const [subtaskDraft, setSubtaskDraft] = useState('')
  /** When set, overrides auto collapse for the completed section. */
  const [doneOpenOverride, setDoneOpenOverride] = useState<boolean | undefined>(undefined)

  const grouped = useMemo(
    () =>
      DISPLAY_ORDER.map((status) => ({
        status,
        rows: orderTasksForStatusColumn(tasks, status),
      })),
    [tasks]
  )

  const counts = useMemo(() => {
    const c: Record<TaskStatus, number> = { todo: 0, in_progress: 0, done: 0 }
    for (const t of tasks) c[t.status]++
    return c
  }, [tasks])

  const doneRows = grouped.find((g) => g.status === 'done')?.rows ?? []
  const autoDoneOpen = doneRows.length <= COLLAPSE_DONE_THRESHOLD
  const doneSectionOpen = doneOpenOverride !== undefined ? doneOpenOverride : autoDoneOpen

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap gap-2 rounded-xl border border-white/[0.08] bg-[var(--color-bg-panel)]/50 px-3 py-2.5"
        aria-label="Task counts"
      >
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-[var(--color-text-muted)]">
          <span className="opacity-80">To do</span>
          <span className="tabular-nums">{counts.todo}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/14 px-2.5 py-1 text-xs font-medium text-amber-100/90">
          <span className="opacity-80">In progress</span>
          <span className="tabular-nums">{counts.in_progress}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-200/95">
          <span className="opacity-80">Done</span>
          <span className="tabular-nums text-emerald-100">{counts.done}</span>
        </span>
      </div>

      {grouped.map(({ status, rows }) => {
        const isDone = status === 'done'
        const isFocus = status === 'in_progress'
        const showDoneToggle = isDone && rows.length > COLLAPSE_DONE_THRESHOLD
        const visibleRows = isDone && showDoneToggle && !doneSectionOpen ? [] : rows

        const sectionBody =
          rows.length === 0 ? (
            <p className="text-sm text-[var(--color-text-faint)]">
              {isFocus
                ? 'Nothing in progress yet—add a step in the workspace above or pull something from To do.'
                : 'Nothing here.'}
            </p>
          ) : visibleRows.length === 0 ? (
            <p className="text-sm text-[var(--color-text-faint)]">
              {rows.length} completed — expand above to review or reopen.
            </p>
          ) : (
            <ul className={isDone ? 'space-y-1.5' : isFocus ? 'space-y-2.5' : 'space-y-2'}>
              {visibleRows.map(({ task, depth, subRowHint }) => (
                <li
                  key={task.id}
                  className={`panel-card flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between ${
                    isDone ? 'border-emerald-500/15 bg-emerald-500/[0.04] py-2 sm:py-2' : ''
                  } ${isDone ? 'px-3' : ''} ${
                    isFocus ? 'border-amber-500/20 bg-[var(--color-bg-deep)]/80 p-3.5' : 'p-3'
                  } ${
                    startHereTaskId === task.id
                      ? 'ring-2 ring-sky-500/50 ring-offset-2 ring-offset-[var(--color-bg-deep)]'
                      : ''
                  } ${
                    celebrateId === task.id && task.status === 'done' ? 'task-row-celebrate' : ''
                  } ${
                    completingId === task.id && task.status !== 'done' ? 'task-row-completing' : ''
                  }`}
                  style={{
                    marginLeft: depth > 0 ? Math.min(depth, 8) * 14 : undefined,
                  }}
                >
                  <div className="flex gap-2 sm:gap-2.5">
                    {task.status === 'done' ? (
                      <button
                        type="button"
                        className="task-done-check task-done-check--filled mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-emerald-950/90"
                        title="Move back to To do"
                        aria-label="Mark not done — move back to To do"
                        onClick={() => submitStatus(task.id, 'todo', onChangeStatus)}
                      >
                        <CheckIcon className="h-3 w-3" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`task-done-check task-done-check--empty relative mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full outline-none hover:border-emerald-400/45 hover:bg-emerald-500/[0.08] focus-visible:ring-2 focus-visible:ring-emerald-400/40 ${
                          completingId === task.id ? 'task-done-check--completing' : ''
                        }`}
                        title="Mark done"
                        aria-label="Mark done"
                        onClick={() => submitStatus(task.id, 'done', onChangeStatus)}
                      >
                        <span className="task-done-check__fill" aria-hidden />
                        <span className="task-done-check__burst" aria-hidden />
                        <CheckIcon className="task-done-check__tick h-3 w-3" />
                        <span className="sr-only">Mark done</span>
                      </button>
                    )}
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
                      className={`w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-faint)] ${
                        isDone
                          ? 'text-[var(--color-text-muted)] line-through decoration-emerald-500/40'
                          : 'text-[var(--color-text-primary)]'
                      } ${isFocus ? 'text-[15px] leading-snug sm:text-base' : ''}`}
                      value={task.title}
                      onChange={(e) => onEditTitle(task.id, e.target.value)}
                      onBlur={() => {
                        const t = task.title.trim()
                        if (t !== task.title) onEditTitle(task.id, t)
                      }}
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
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <TaskDuration
                      task={task}
                      className={`min-w-[3rem] text-right ${isDone ? 'text-[var(--color-text-faint)]' : ''}`}
                    />
                    <select
                      className="rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none"
                      value={task.status}
                      onChange={(e) =>
                        submitStatus(task.id, e.target.value as TaskStatus, onChangeStatus)
                      }
                      aria-label={task.status === 'done' ? 'Task status' : 'Move between To do and In progress'}
                    >
                      <option value="todo">To do</option>
                      <option value="in_progress">In progress</option>
                      {task.status === 'done' ? <option value="done">Done</option> : null}
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
          )

        if (isFocus) {
          return (
            <section key={status} className="space-y-3">
              <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/[0.09] to-[var(--color-bg-panel)]/30 p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <h3 className="shrink-0 text-xs font-semibold uppercase tracking-wider text-amber-100/90">
                    {LABELS[status]}
                    <span className="ml-2 font-normal normal-case tracking-normal text-[var(--color-text-faint)]">
                      · {rows.length} active
                    </span>
                  </h3>
                  {inProgressPrimaryTitle && (
                    <p
                      className="min-w-0 text-sm font-medium leading-snug text-[var(--color-text-primary)] sm:max-w-[65%] sm:text-right"
                      title={inProgressPrimaryTitle}
                    >
                      {inProgressPrimaryTitle}
                    </p>
                  )}
                </div>
                {inProgressWorkspace && <div className="mt-4 space-y-4">{inProgressWorkspace}</div>}
                <div className={inProgressWorkspace ? 'mt-5 border-t border-amber-500/15 pt-5' : 'mt-4'}>
                  {sectionBody}
                </div>
              </div>
            </section>
          )
        }

        return (
          <section key={status}>
            {isDone && showDoneToggle ? (
              <button
                type="button"
                onClick={() => setDoneOpenOverride(!doneSectionOpen)}
                className="mb-3 flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-2.5 text-left transition hover:bg-emerald-500/12"
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-200/90">
                  {LABELS[status]}
                  <span className="ml-2 font-normal normal-case tracking-normal text-emerald-100/70">
                    · {rows.length} {rows.length === 1 ? 'task' : 'tasks'}
                  </span>
                </h3>
                <span className="shrink-0 text-[11px] font-medium text-emerald-200/80">
                  {doneSectionOpen ? 'Hide' : 'Show all'}
                </span>
              </button>
            ) : (
              <h3
                className={`mb-3 text-xs font-semibold uppercase tracking-wider ${
                  isDone ? 'text-emerald-200/85' : 'text-[var(--color-text-muted)]'
                }`}
              >
                {LABELS[status]}
                {rows.length > 0 && (
                  <span className="ml-2 font-normal normal-case tracking-normal text-[var(--color-text-faint)]">
                    · {rows.length}
                  </span>
                )}
              </h3>
            )}

            {sectionBody}
          </section>
        )
      })}
    </div>
  )
}
