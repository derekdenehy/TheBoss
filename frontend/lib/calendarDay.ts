import type { CalendarEvent, Session, Task } from './types'
import { calendarEventTouchesLocalDay, displayScheduleOnDay } from './calendarRecurrence'

/** Local calendar YYYY-MM-DD for an ISO timestamp. */
export function localDateKeyFromIso(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Events that touch a given local calendar day (including recurrence). */
export function eventsTouchingLocalDay(events: CalendarEvent[], dayYmd: string): CalendarEvent[] {
  return events.filter((e) => calendarEventTouchesLocalDay(e, dayYmd))
}

export type TaskDuePromptRow = {
  title: string
  status: string
  roleName: string
  dueAt?: string
}

function daysUntil(fromYmd: string, toYmd: string): number | null {
  const a = new Date(fromYmd + 'T12:00:00')
  const b = new Date(toYmd + 'T12:00:00')
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

/** Tasks due today and within the next few days — for Boss chat grounding. */
export function formatTasksDueHorizonBlock(rows: TaskDuePromptRow[], todayYmd: string): string {
  const open = rows.filter((r) => r.status !== 'done')
  const dueToday = open.filter((r) => r.dueAt === todayYmd)
  const dueSoon = open.filter((r) => {
    if (!r.dueAt || r.dueAt <= todayYmd) return false
    const d = daysUntil(todayYmd, r.dueAt)
    return d !== null && d > 0 && d <= 7
  })

  if (dueToday.length === 0 && dueSoon.length === 0) {
    return `## Tasks (due dates)\nNo open tasks with due dates today or in the next 7 days.`
  }

  const linesToday = dueToday.map((r) => {
    const st = r.status === 'in_progress' ? ' [in progress]' : ''
    return `- ${r.title.trim() || 'Untitled'} (${r.roleName}) — due ${todayYmd}${st}`
  })
  const linesSoon = dueSoon.map((r) => {
    const d = r.dueAt ? daysUntil(todayYmd, r.dueAt) : null
    const st = r.status === 'in_progress' ? ' [in progress]' : ''
    return `- ${r.title.trim() || 'Untitled'} (${r.roleName}) — due ${r.dueAt}${d != null ? ` (in ${d}d)` : ''}${st}`
  })

  const parts: string[] = [
    `## Tasks — due soon (${todayYmd} local)`,
    `Use these together with the calendar: prefer nudging tasks due today; mention upcoming dues when choosing what to front-load.`,
  ]
  if (linesToday.length) {
    parts.push('Due **today**:', ...linesToday)
  }
  if (linesSoon.length) {
    parts.push('Due within **7 days** (not including today):', ...linesSoon)
  }
  return parts.join('\n')
}

export function tasksToPromptRows(
  tasks: Task[],
  roleName: (roleId: string) => string
): TaskDuePromptRow[] {
  return tasks.map((t) => ({
    title: t.title,
    status: t.status,
    roleName: roleName(t.roleId),
    dueAt: t.dueAt,
  }))
}

export function formatTodayCalendarBlock(events: CalendarEvent[], todayYmd: string): string {
  const today = eventsTouchingLocalDay(events, todayYmd)
  if (today.length === 0) {
    return `## Calendar (local ${todayYmd})\nNo events on the calendar for today (including recurring). You may still use task due dates below.`
  }
  const lines = today.map((e) => {
    const disp = displayScheduleOnDay(e, todayYmd)
    let time = ''
    if (disp?.type === 'timed' && !Number.isNaN(disp.at.getTime())) {
      time = disp.at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    } else if (disp?.type === 'continues') {
      time = 'continues'
    }
    const recur = e.recurrence
      ? ` · repeats ${e.recurrence.freq}${e.recurrence.interval && e.recurrence.interval > 1 ? ` every ${e.recurrence.interval}` : ''}`
      : ''
    const rawNote = e.notes?.trim()
    const note =
      rawNote && rawNote.length > 0
        ? rawNote.length > 120
          ? `${rawNote.slice(0, 117)}…`
          : rawNote
        : ''
    return `- ${e.title.trim() || 'Untitled'}${time ? ` (${time})` : ''}${recur}${note ? ` · note: ${note}` : ''}`
  })
  return `## Calendar — today (${todayYmd})\nFixed and recurring events touching this day. Nudge gently on deadlines and time-bound items.\n${lines.join('\n')}`
}

/**
 * Tasks marked done whose `completedAt` falls on this local calendar day (same local date rules as
 * `localDateKeyFromIso`). Requires `completedAt`; legacy done tasks without it are excluded.
 */
export function tasksCompletedOnLocalDay(tasks: Task[], dayYmd: string): Task[] {
  return tasks.filter((t) => {
    if (t.status !== 'done' || !t.completedAt) return false
    return localDateKeyFromIso(t.completedAt) === dayYmd
  })
}

/**
 * Tasks completed while a role clock-in session was open: same role, `completedAt` in
 * [session.startTime, session.endTime ?? nowRef]. Used for session summaries and dashboard.
 */
export function tasksCompletedInSessionWindow(
  tasks: Task[],
  session: Session,
  nowRef: number = Date.now()
): Task[] {
  const start = new Date(session.startTime).getTime()
  const end = session.endTime ? new Date(session.endTime).getTime() : nowRef
  return tasks.filter((t) => {
    if (t.roleId !== session.roleId || t.status !== 'done' || !t.completedAt) return false
    const c = new Date(t.completedAt).getTime()
    return c >= start && c <= end
  })
}

/**
 * Done tasks whose completion time fell inside any *active* clock-in session (union across roles).
 * Empty when nothing is clocked in.
 */
export function tasksCompletedDuringAnyActiveSession(
  tasks: Task[],
  sessions: Session[],
  nowRef: number = Date.now()
): Task[] {
  const active = sessions.filter((s) => s.active)
  if (active.length === 0) return []
  const byId = new Map<string, Task>()
  for (const session of active) {
    for (const t of tasksCompletedInSessionWindow(tasks, session, nowRef)) {
      byId.set(t.id, t)
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
  )
}
