'use client'

import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'
import { getTodayKey } from '@/lib/dailyBoss'
import {
  dateKeyFromParts,
  eventToLocalDateKey,
  monthGridCells,
  parseLocalDateKey,
  type YearMonth,
} from '@/lib/calendarUtils'
import { useAppState } from '@/context/AppStateContext'

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dateKeyInMonth(key: string, ym: YearMonth): boolean {
  const d = parseLocalDateKey(key)
  if (!d) return false
  return d.getFullYear() === ym.year && d.getMonth() === ym.month
}

export function BossCalendarTab() {
  const todayKey = getTodayKey()
  const {
    calendarEvents,
    tasks,
    addCalendarEvent,
    deleteCalendarEvent,
    updateTask,
    getRoleById,
  } = useAppState()

  const now = new Date()
  const [ym, setYm] = useState<YearMonth>({
    year: now.getFullYear(),
    month: now.getMonth(),
  })
  const [selectedKey, setSelectedKey] = useState<string>(todayKey)

  const cells = useMemo(() => monthGridCells(ym), [ym])

  const eventsThisMonth = useMemo(() => {
    return calendarEvents.filter((e) => dateKeyInMonth(eventToLocalDateKey(e.startsAt), ym))
  }, [calendarEvents, ym])

  const tasksThisMonth = useMemo(() => {
    return tasks.filter((t) => t.dueAt && dateKeyInMonth(t.dueAt, ym))
  }, [tasks, ym])

  const countsByDay = useMemo(() => {
    const m = new Map<string, { ev: number; td: number }>()
    for (const e of eventsThisMonth) {
      const k = eventToLocalDateKey(e.startsAt)
      const cur = m.get(k) ?? { ev: 0, td: 0 }
      cur.ev += 1
      m.set(k, cur)
    }
    for (const t of tasksThisMonth) {
      if (!t.dueAt) continue
      const cur = m.get(t.dueAt) ?? { ev: 0, td: 0 }
      cur.td += 1
      m.set(t.dueAt, cur)
    }
    return m
  }, [eventsThisMonth, tasksThisMonth])

  const selectedEvents = useMemo(() => {
    return calendarEvents.filter((e) => eventToLocalDateKey(e.startsAt) === selectedKey)
  }, [calendarEvents, selectedKey])

  const selectedTasks = useMemo(() => {
    return tasks.filter((t) => t.dueAt === selectedKey)
  }, [tasks, selectedKey])

  const [evTitle, setEvTitle] = useState('')
  const [evStart, setEvStart] = useState('09:00')
  const [evEnd, setEvEnd] = useState('')
  const [evLoc, setEvLoc] = useState('')
  const [evNotes, setEvNotes] = useState('')
  const [taskPick, setTaskPick] = useState('')

  const shiftMonth = (delta: number) => {
    setYm((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const submitEvent = (e: FormEvent) => {
    e.preventDefault()
    const title = evTitle.trim()
    if (!title) return
    const localStart = `${selectedKey}T${evStart}:00`
    const startDate = new Date(localStart)
    if (Number.isNaN(startDate.getTime())) return
    let endsAt: string | undefined
    if (evEnd.trim()) {
      const endDate = new Date(`${selectedKey}T${evEnd}:00`)
      if (!Number.isNaN(endDate.getTime())) endsAt = endDate.toISOString()
    }
    addCalendarEvent({
      title,
      startsAt: startDate.toISOString(),
      endsAt,
      location: evLoc.trim() || undefined,
      notes: evNotes.trim() || undefined,
    })
    setEvTitle('')
    setEvNotes('')
  }

  const assignDue = (e: FormEvent) => {
    e.preventDefault()
    if (!taskPick) return
    updateTask(taskPick, { dueAt: selectedKey })
    setTaskPick('')
  }

  const tasksWithoutDue = useMemo(
    () => tasks.filter((t) => !t.dueAt && t.status !== 'done'),
    [tasks]
  )

  const label = `${ym.year}–${String(ym.month + 1).padStart(2, '0')}`

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,340px)]">
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-white/[0.04]"
          >
            ←
          </button>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-white/[0.04]"
          >
            →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-faint)]">
          {WEEK.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`e-${i}`} className="min-h-[4.5rem] rounded-lg bg-transparent" />
            }
            const key = dateKeyFromParts(ym, day)
            const c = countsByDay.get(key) ?? { ev: 0, td: 0 }
            const isToday = key === todayKey
            const isSel = key === selectedKey
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedKey(key)}
                className={`flex min-h-[4.5rem] flex-col rounded-lg border p-1.5 text-left transition ${
                  isSel
                    ? 'border-sky-500/50 bg-sky-500/15'
                    : 'border-white/[0.06] bg-[var(--color-bg-panel)]/30 hover:border-white/15'
                } ${isToday ? 'ring-1 ring-sky-400/40' : ''}`}
              >
                <span className="text-xs font-semibold text-[var(--color-text-primary)]">{day}</span>
                <div className="mt-auto flex flex-wrap gap-1">
                  {c.ev > 0 && (
                    <span className="rounded bg-violet-500/25 px-1 text-[9px] font-medium text-violet-100">
                      {c.ev} ev
                    </span>
                  )}
                  {c.td > 0 && (
                    <span className="rounded bg-amber-500/20 px-1 text-[9px] font-medium text-amber-100">
                      {c.td} ts
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="panel-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
            {selectedKey}
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {selectedEvents.map((ev) => (
              <li
                key={ev.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-white/[0.06] bg-[var(--color-bg-deep)]/50 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">{ev.title}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {new Date(ev.startsAt).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    {ev.location ? ` · ${ev.location}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteCalendarEvent(ev.id)}
                  className="shrink-0 text-xs text-rose-300/90 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
            {selectedTasks.map((t) => (
              <li
                key={t.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">{t.title}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Task · {getRoleById(t.roleId)?.name ?? 'Role'}
                  </p>
                </div>
                <Link
                  href={`/boss/role/${t.roleId}`}
                  className="shrink-0 text-xs text-sky-300 hover:underline"
                >
                  Open
                </Link>
              </li>
            ))}
            {selectedEvents.length === 0 && selectedTasks.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)]">Nothing scheduled this day.</p>
            )}
          </ul>
        </div>

        <form onSubmit={submitEvent} className="panel-card space-y-3 p-4">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">New event</p>
          <input
            required
            placeholder="Title"
            value={evTitle}
            onChange={(e) => setEvTitle(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm outline-none focus:border-sky-500/40"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-[var(--color-text-faint)]">
              Start
              <input
                type="time"
                value={evStart}
                onChange={(e) => setEvStart(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-2 py-1.5 text-sm outline-none"
              />
            </label>
            <label className="text-xs text-[var(--color-text-faint)]">
              End (optional)
              <input
                type="time"
                value={evEnd}
                onChange={(e) => setEvEnd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-2 py-1.5 text-sm outline-none"
              />
            </label>
          </div>
          <input
            placeholder="Location (optional)"
            value={evLoc}
            onChange={(e) => setEvLoc(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm outline-none focus:border-sky-500/40"
          />
          <textarea
            placeholder="Notes (optional)"
            value={evNotes}
            onChange={(e) => setEvNotes(e.target.value)}
            className="min-h-[4rem] w-full rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm outline-none focus:border-sky-500/40"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-sky-500/90 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
          >
            Add to {selectedKey}
          </button>
        </form>

        <form onSubmit={assignDue} className="panel-card space-y-3 p-4">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            Assign task due date
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Sets due on <strong className="text-[var(--color-text-primary)]">{selectedKey}</strong>
          </p>
          <select
            value={taskPick}
            onChange={(e) => setTaskPick(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm outline-none focus:border-sky-500/40"
          >
            <option value="">Choose a task without a due date…</option>
            {tasksWithoutDue.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} · {getRoleById(t.roleId)?.name ?? '?'}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!taskPick}
            className="w-full rounded-xl border border-white/15 py-2.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-white/[0.04] disabled:opacity-40"
          >
            Set due date
          </button>
        </form>
      </div>
    </div>
  )
}
