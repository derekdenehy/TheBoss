/** Calendar grid helpers — month view uses local timezone. */

export type YearMonth = { year: number; month: number }

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** YYYY-MM-DD from local Date */
export function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function parseLocalDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const day = Number(m[3])
  const d = new Date(y, mo, day)
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== day) return null
  return d
}

export function startOfMonth(ym: YearMonth): Date {
  return new Date(ym.year, ym.month, 1)
}

export function daysInMonth(ym: YearMonth): number {
  return new Date(ym.year, ym.month + 1, 0).getDate()
}

/** First column = Sunday (0) … Saturday (6), matching Date.getDay() */
export function monthGridCells(ym: YearMonth): (number | null)[] {
  const first = startOfMonth(ym)
  const pad = first.getDay()
  const dim = daysInMonth(ym)
  const cells: (number | null)[] = []
  for (let i = 0; i < pad; i++) cells.push(null)
  for (let d = 1; d <= dim; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function dateKeyFromParts(ym: YearMonth, day: number): string {
  return `${ym.year}-${pad2(ym.month + 1)}-${pad2(day)}`
}

/** ISO or datetime-local → date key in local TZ */
export function eventToLocalDateKey(isoLike: string): string {
  const d = new Date(isoLike)
  if (Number.isNaN(d.getTime())) return ''
  return toLocalDateKey(d)
}
