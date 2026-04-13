import type { CalendarEvent } from './types'
import { parseLocalDateKey, toLocalDateKey } from './calendarUtils'

function daysInMonth(y: number, m0: number): number {
  return new Date(y, m0 + 1, 0).getDate()
}

function ymdParts(key: string): { y: number; m: number; d: number } | null {
  const d = parseLocalDateKey(key)
  if (!d) return null
  return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() }
}

/** Local YYYY-MM-DD for an ISO datetime string. */
export function localKeyFromIso(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return toLocalDateKey(d)
}

function daysBetweenYmd(a: string, b: string): number | null {
  const da = parseLocalDateKey(a)
  const db = parseLocalDateKey(b)
  if (!da || !db) return null
  const t0 = new Date(da.getFullYear(), da.getMonth(), da.getDate()).getTime()
  const t1 = new Date(db.getFullYear(), db.getMonth(), db.getDate()).getTime()
  return Math.round((t1 - t0) / 86400000)
}

function isRecurrenceOccurrenceOnDay(
  event: CalendarEvent,
  seriesStartKey: string,
  dayYmd: string
): boolean {
  const rule = event.recurrence
  if (!rule) return false
  const interval = rule.interval && rule.interval > 0 ? Math.floor(rule.interval) : 1
  if (dayYmd < seriesStartKey) return false
  if (rule.until && dayYmd > rule.until) return false

  const s = ymdParts(seriesStartKey)
  const t = ymdParts(dayYmd)
  if (!s || !t) return false
  const d0 = s.d

  if (rule.freq === 'daily') {
    const diff = daysBetweenYmd(seriesStartKey, dayYmd)
    return diff !== null && diff >= 0 && diff % interval === 0
  }

  if (rule.freq === 'weekly') {
    const ds = parseLocalDateKey(seriesStartKey)
    const dt = parseLocalDateKey(dayYmd)
    if (!ds || !dt) return false
    if (ds.getDay() !== dt.getDay()) return false
    const diff = daysBetweenYmd(seriesStartKey, dayYmd)
    return diff !== null && diff >= 0 && diff % (7 * interval) === 0
  }

  if (rule.freq === 'monthly') {
    const monthsApart = (t.y - s.y) * 12 + (t.m - s.m)
    if (monthsApart < 0 || monthsApart % interval !== 0) return false
    const dim = daysInMonth(t.y, t.m)
    const expectedDay = Math.min(d0, dim)
    return t.d === expectedDay
  }

  return false
}

/** True if this calendar event should appear on the given local calendar day. */
export function calendarEventTouchesLocalDay(event: CalendarEvent, dayYmd: string): boolean {
  const startKey = localKeyFromIso(event.startsAt)
  if (!startKey) return false

  if (!event.recurrence) {
    const endKey = event.endsAt ? localKeyFromIso(event.endsAt) : startKey
    if (!endKey) return startKey === dayYmd
    return startKey <= dayYmd && dayYmd <= endKey
  }

  return isRecurrenceOccurrenceOnDay(event, startKey, dayYmd)
}

/**
 * How to show an event on a given day: clock time on that day, or a continuation of a multi-day block.
 */
export function displayScheduleOnDay(
  event: CalendarEvent,
  dayYmd: string
): { type: 'timed'; at: Date } | { type: 'continues' } | null {
  if (!calendarEventTouchesLocalDay(event, dayYmd)) return null
  const sk = localKeyFromIso(event.startsAt)
  if (!sk) return null
  const base = new Date(event.startsAt)
  if (Number.isNaN(base.getTime())) return null

  if (event.recurrence) {
    const parts = ymdParts(dayYmd)
    if (!parts) return null
    return {
      type: 'timed',
      at: new Date(parts.y, parts.m, parts.d, base.getHours(), base.getMinutes(), 0, 0),
    }
  }

  if (sk === dayYmd) {
    return { type: 'timed', at: base }
  }

  const endKey = event.endsAt ? localKeyFromIso(event.endsAt) : sk
  if (endKey && sk < dayYmd && dayYmd <= endKey) {
    return { type: 'continues' }
  }

  return null
}
