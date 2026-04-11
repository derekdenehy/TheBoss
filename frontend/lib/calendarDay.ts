import type { CalendarEvent } from './types'

/** Local calendar YYYY-MM-DD for an ISO timestamp. */
export function localDateKeyFromIso(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Events that touch a given local calendar day (start, end, or span). */
export function eventsTouchingLocalDay(events: CalendarEvent[], dayYmd: string): CalendarEvent[] {
  return events.filter((e) => {
    const startKey = localDateKeyFromIso(e.startsAt)
    if (!startKey) return false
    const endKey = e.endsAt ? localDateKeyFromIso(e.endsAt) : startKey
    if (!endKey) return startKey === dayYmd
    return startKey <= dayYmd && dayYmd <= endKey
  })
}

export function formatTodayCalendarBlock(events: CalendarEvent[], todayYmd: string): string {
  const today = eventsTouchingLocalDay(events, todayYmd)
  if (today.length === 0) {
    return `## Calendar (local ${todayYmd})\nNo events recorded for today. You may proactively help rank projects and ask the user to verify priorities.`
  }
  const lines = today.map((e) => {
    const start = localDateKeyFromIso(e.startsAt)
    const t = new Date(e.startsAt)
    const time =
      !Number.isNaN(t.getTime())
        ? t.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
        : ''
    return `- ${e.title.trim() || 'Untitled'}${time ? ` (${time})` : ''}${start ? ` · ${start}` : ''}`
  })
  return `## Calendar — due / happening today (${todayYmd})\nThe user has these on the calendar. If something is academic work or a deadline, gently nudge whether they've started — without nagging.\n${lines.join('\n')}`
}
