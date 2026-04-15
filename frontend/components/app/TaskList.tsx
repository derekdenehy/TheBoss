'use client'

import Link from 'next/link'
import { useId, useMemo, useState, type ReactNode } from 'react'
import { useTaskDoneCelebration } from '@/hooks/useTaskDoneCelebration'
import { orderTasksForStatusColumn } from '@/lib/taskTree'
import type { Task, TaskStatus } from '@/lib/types'
import { TaskDuration } from './TaskDuration'

/** Natural flow: queue → focus → archive. */
const DISPLAY_ORDER: TaskStatus[] = ['todo', 'in_progress', 'done']

/** Global dashboard: active work first. */
const GLOBAL_DISPLAY_ORDER: TaskStatus[] = ['in_progress', 'todo', 'done']

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

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M6 8l4 4 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M6 12l4-4 4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Heuristic: title may not fit one line in the row layout. */
function titleBenefitsFromExpand(title: string): boolean {
  const t = title
  return t.length > 44 || t.includes('\n')
}

function textareaRowsForTitle(title: string): number {
  const lines = title.split('\n')
  let rows = 0
  for (const line of lines) {
    rows += Math.max(1, Math.ceil(line.length / 72))
  }
  return Math.min(14, Math.max(3, rows))
}

function TaskTitleEditor({
  taskId,
  title,
  expanded,
  isDone,
  isFocus,
  onEditTitle,
  onToggleExpand,
}: {
  taskId: string
  title: string
  expanded: boolean
  isDone: boolean
  isFocus: boolean
  onEditTitle: (id: string, next: string) => void
  onToggleExpand: (id: string) => void
}) {
  const showExpandToggle = titleBenefitsFromExpand(title) || expanded
  const titleTone = isDone
    ? 'text-[var(--color-text-muted)] line-through decoration-emerald-500/40'
    : 'text-[var(--color-text-primary)]'
  const titleSize = isFocus ? 'text-[15px] leading-snug sm:text-base' : 'text-sm'
  const onTitleBlur = () => {
    const t = title.trim()
    if (t !== title) onEditTitle(taskId, t)
  }

  return (
    <div className="flex min-w-0 items-start gap-1">
      <div className="min-w-0 flex-1">
        {expanded ? (
          <textarea
            className={`min-h-[5rem] w-full resize-y rounded-lg border border-white/10 bg-[var(--color-bg-deep)]/50 px-2 py-2 leading-snug outline-none ring-sky-500/0 transition placeholder:text-[var(--color-text-faint)] focus:border-sky-500/35 focus:ring-2 focus:ring-sky-500/25 ${titleTone} ${titleSize}`}
            rows={textareaRowsForTitle(title)}
            value={title}
            onChange={(e) => onEditTitle(taskId, e.target.value)}
            onBlur={onTitleBlur}
            aria-label="Task title"
          />
        ) : (
          <input
            className={`block min-w-0 w-full max-w-full truncate bg-transparent outline-none placeholder:text-[var(--color-text-faint)] ${titleTone} ${titleSize}`}
            value={title}
            title={title}
            onChange={(e) => onEditTitle(taskId, e.target.value)}
            onBlur={onTitleBlur}
            aria-label="Task title"
          />
        )}
      </div>
      {showExpandToggle && (
        <button
          type="button"
          onClick={() => onToggleExpand(taskId)}
          className="mt-0.5 shrink-0 rounded-md p-1 text-[var(--color-text-faint)] hover:bg-white/[0.08] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/35"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse title' : 'Expand full title'}
        >
          {expanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
        </button>
      )}
    </div>
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
  /** When set, shows a role label per task and uses a flat layout for every column (Boss global list). */
  getRoleLabel?: (task: Task) => string
  /** Wrap role label in a link (e.g. `/boss/role/:id`). Only used when `getRoleLabel` is set. */
  roleHrefForTask?: (task: Task) => string
  /** Role workspace: only the To do column is collapsible; In progress / Done stay visible. */
  collapsibleTodo?: boolean
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
  getRoleLabel,
  roleHrefForTask,
  collapsibleTodo = false,
}: Props) {
  const { completingId, celebrateId, submitStatus } = useTaskDoneCelebration()
  const [subtaskParentId, setSubtaskParentId] = useState<string | null>(null)
  const [subtaskDraft, setSubtaskDraft] = useState('')
  /** When set, overrides auto collapse for the completed section. */
  const [doneOpenOverride, setDoneOpenOverride] = useState<boolean | undefined>(undefined)
  /** Task ids showing full multiline title editor. */
  const [expandedTitleIds, setExpandedTitleIds] = useState<Set<string>>(() => new Set())
  const [todoSectionOpen, setTodoSectionOpen] = useState(true)
  const todoPanelId = useId()

  const toggleTitleExpanded = (id: string) => {
    setExpandedTitleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const displayOrder = getRoleLabel ? GLOBAL_DISPLAY_ORDER : DISPLAY_ORDER

  const grouped = useMemo(
    () =>
      displayOrder.map((status) => ({
        status,
        rows: orderTasksForStatusColumn(tasks, status),
      })),
    [tasks, displayOrder]
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
        {displayOrder.map((status) => (
          <span
            key={status}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
              status === 'todo'
                ? 'bg-white/[0.06] text-[var(--color-text-muted)]'
                : status === 'in_progress'
                  ? 'bg-amber-500/14 text-amber-100/90'
                  : 'bg-emerald-500/15 text-emerald-200/95'
            }`}
          >
            <span className="opacity-80">
              {status === 'done' ? 'Done' : LABELS[status]}
            </span>
            <span
              className={`tabular-nums ${status === 'done' ? 'text-emerald-100' : ''}`}
            >
              {counts[status]}
            </span>
          </span>
        ))}
      </div>

      {grouped.map(({ status, rows }) => {
        const isDone = status === 'done'
        const inProgressChrome = status === 'in_progress' && getRoleLabel === undefined
        const isFocus = inProgressChrome
        const showDoneToggle = isDone && rows.length > COLLAPSE_DONE_THRESHOLD
        const visibleRows = isDone && showDoneToggle && !doneSectionOpen ? [] : rows

        const emptyInProgressMsg =
          getRoleLabel !== undefined
            ? 'Nothing in progress across your roles yet.'
            : 'Nothing in progress yet—add a step in the workspace above or pull something from To do.'

        const sectionBody =
          rows.length === 0 ? (
            <p className="text-sm text-[var(--color-text-faint)]">
              {status === 'in_progress' ? emptyInProgressMsg : 'Nothing here.'}
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
                  <div className="flex min-w-0 flex-1 gap-2 sm:gap-2.5">
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
                    {getRoleLabel && (
                      <span className="mb-1.5 block">
                        {roleHrefForTask ? (
                          <Link
                            href={roleHrefForTask(task)}
                            className="inline-flex rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300/90 hover:border-sky-500/35 hover:bg-sky-500/10"
                          >
                            {getRoleLabel(task)}
                          </Link>
                        ) : (
                          <span className="inline-flex rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                            {getRoleLabel(task)}
                          </span>
                        )}
                      </span>
                    )}
                    {startHereTaskId === task.id && (
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                        Start here
                      </span>
                    )}
                    {subRowHint && (
                      <p className="mb-1 text-[10px] text-[var(--color-text-faint)]">{subRowHint}</p>
                    )}
                    <TaskTitleEditor
                      taskId={task.id}
                      title={task.title}
                      expanded={expandedTitleIds.has(task.id)}
                      isDone={isDone}
                      isFocus={isFocus}
                      onEditTitle={onEditTitle}
                      onToggleExpand={toggleTitleExpanded}
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

        if (inProgressChrome) {
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

        if (status === 'todo' && collapsibleTodo) {
          return (
            <section key={status} className="panel-card overflow-hidden border-white/[0.08]">
              <button
                type="button"
                onClick={() => setTodoSectionOpen((o) => !o)}
                className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition hover:bg-white/[0.03] sm:px-4 sm:py-3.5"
                aria-expanded={todoSectionOpen}
                aria-controls={todoPanelId}
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {LABELS[status]}
                    <span className="ml-2 font-normal normal-case tracking-normal text-[var(--color-text-faint)]">
                      · {rows.length}
                    </span>
                  </h3>
                  <p className="mt-1 text-[11px] leading-snug text-[var(--color-text-muted)] sm:text-xs">
                    {todoSectionOpen
                      ? 'Queue next steps here; move work to In progress when you are on it.'
                      : `${rows.length} queued — expand to view or edit.`}
                  </p>
                </div>
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[var(--color-text-muted)]">
                  <ChevronDownIcon
                    className={`h-4 w-4 transition-transform duration-200 ${todoSectionOpen ? 'rotate-180' : ''}`}
                  />
                </span>
              </button>
              <div
                id={todoPanelId}
                hidden={!todoSectionOpen}
                className="border-t border-white/[0.06] px-3 pb-4 pt-1 sm:px-4"
              >
                {sectionBody}
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
