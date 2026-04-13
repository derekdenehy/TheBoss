'use client'

import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'
import { getTodayKey } from '@/lib/dailyBoss'
import {
  addDaysToYmd,
  dateKeyFromParts,
  monthGridCells,
  shiftMonthPreserveDay,
  weekRangeSundayContaining,
  yearMonthFromYmd,
} from '@/lib/calendarUtils'
import { displayScheduleOnDay } from '@/lib/calendarRecurrence'
import { eventsTouchingLocalDay } from '@/lib/calendarDay'
import { useAppState } from '@/context/AppStateContext'
import type { CalendarEvent, CalendarRecurrenceFreq, Task } from '@/lib/types'

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type CalendarViewMode = 'month' | 'week' | 'day'

const PREVIEW_CHARS = 22
const MAX_PREVIEWS = 3

function truncateTitle(s: string, n = PREVIEW_CHARS): string {
  const t = s.trim()
  if (!t) return 'Untitled'
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`
}

function recurrenceLabel(freq: CalendarRecurrenceFreq): string {
  if (freq === 'daily') return 'Daily'
  if (freq === 'weekly') return 'Weekly'
  return 'Monthly'
}

type DayBlock = { events: CalendarEvent[]; tasks: Task[] }

function sortEventsForDay(events: CalendarEvent[], dayYmd: string): CalendarEvent[] {
  return [...events].sort((a, b) => {
    const da = displayScheduleOnDay(a, dayYmd)
    const db = displayScheduleOnDay(b, dayYmd)
    const ta =
      da?.type === 'timed'
        ? da.at.getTime()
        : da?.type === 'continues'
          ? -1
          : 9e15
    const tb =
      db?.type === 'timed'
        ? db.at.getTime()
        : db?.type === 'continues'
          ? -1
          : 9e15
    return ta - tb
  })
}

function eventTimeLabel(ev: CalendarEvent, dayYmd: string): string {
  const disp = displayScheduleOnDay(ev, dayYmd)
  if (disp?.type === 'timed' && !Number.isNaN(disp.at.getTime())) {
    return disp.at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  if (disp?.type === 'continues') return 'All day'
  return ''
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

  const [viewMode, setViewMode] = useState<CalendarViewMode>('month')
  const [selectedKey, setSelectedKey] = useState<string>(todayKey)

  const displayYm = useMemo(() => {
    return yearMonthFromYmd(selectedKey) ?? (() => {
      const n = new Date()
      return { year: n.getFullYear(), month: n.getMonth() }
    })()
  }, [selectedKey])

  const monthCells = useMemo(() => monthGridCells(displayYm), [displayYm])

  const monthDayKeys = useMemo(() => {
    const keys: string[] = []
    for (const day of monthCells) {
      if (day !== null) keys.push(dateKeyFromParts(displayYm, day))
    }
    return keys
  }, [monthCells, displayYm])

  const weekDayKeys = useMemo(() => {
    const { start } = weekRangeSundayContaining(selectedKey)
    const keys: string[] = []
    let k = start
    for (let i = 0; i < 7; i++) {
      keys.push(k)
      k = addDaysToYmd(k, 1)
    }
    return keys
  }, [selectedKey])

  const visibleDayKeys = useMemo(() => {
    if (viewMode === 'day') return [selectedKey]
    if (viewMode === 'week') return weekDayKeys
    return monthDayKeys
  }, [viewMode, selectedKey, weekDayKeys, monthDayKeys])

  const dayBlocks = useMemo(() => {
    const m = new Map<string, DayBlock>()
    for (const key of visibleDayKeys) {
      m.set(key, {
        events: eventsTouchingLocalDay(calendarEvents, key),
        tasks: tasks.filter((t) => t.dueAt === key && t.status !== 'done'),
      })
    }
    return m
  }, [visibleDayKeys, calendarEvents, tasks])

  const selectedBlock = dayBlocks.get(selectedKey) ?? { events: [], tasks: [] }
  const selectedEventsSorted = useMemo(
    () => sortEventsForDay(selectedBlock.events, selectedKey),
    [selectedBlock.events, selectedKey]
  )

  const selectedTasks = selectedBlock.tasks

  const [evTitle, setEvTitle] = useState('')
  const [evStart, setEvStart] = useState('09:00')
  const [evEnd, setEvEnd] = useState('')
  const [evLoc, setEvLoc] = useState('')
  const [evNotes, setEvNotes] = useState('')
  const [evRecurrence, setEvRecurrence] = useState<'none' | CalendarRecurrenceFreq>('none')
  const [evRecUntil, setEvRecUntil] = useState('')
  const [taskPick, setTaskPick] = useState('')

  const navPrev = () => {
    if (viewMode === 'month') setSelectedKey((k) => shiftMonthPreserveDay(k, -1))
    else if (viewMode === 'week') setSelectedKey((k) => addDaysToYmd(k, -7))
    else setSelectedKey((k) => addDaysToYmd(k, -1))
  }

  const navNext = () => {
    if (viewMode === 'month') setSelectedKey((k) => shiftMonthPreserveDay(k, 1))
    else if (viewMode === 'week') setSelectedKey((k) => addDaysToYmd(k, 7))
    else setSelectedKey((k) => addDaysToYmd(k, 1))
  }

  const headerLabel = useMemo(() => {
    if (viewMode === 'day') {
      const d = new Date(selectedKey + 'T12:00:00')
      return d.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    }
    if (viewMode === 'week') {
      const { start, end } = weekRangeSundayContaining(selectedKey)
      const a = new Date(start + 'T12:00:00')
      const b = new Date(end + 'T12:00:00')
      return `${a.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${b.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    return `${displayYm.year}–${String(displayYm.month + 1).padStart(2, '0')}`
  }, [viewMode, selectedKey, displayYm])

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
    const recurrence =
      evRecurrence === 'none'
        ? undefined
        : {
            freq: evRecurrence,
            ...(evRecUntil.trim() && /^\d{4}-\d{2}-\d{2}$/.test(evRecUntil.trim())
              ? { until: evRecUntil.trim() }
              : {}),
          }
    addCalendarEvent({
      title,
      startsAt: startDate.toISOString(),
      endsAt,
      location: evLoc.trim() || undefined,
      notes: evNotes.trim() || undefined,
      ...(recurrence ? { recurrence } : {}),
    })
    setEvTitle('')
    setEvNotes('')
    setEvRecurrence('none')
    setEvRecUntil('')
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

  const renderMonthDayCell = (key: string, dayNum: number) => {
    const block = dayBlocks.get(key) ?? { events: [], tasks: [] }
    const isToday = key === todayKey
    const isSel = key === selectedKey
    const evTitles = block.events.map((e) => e.title)
    const tsTitles = block.tasks.map((t) => t.title)
    const more =
      evTitles.length + tsTitles.length > MAX_PREVIEWS
        ? evTitles.length + tsTitles.length - MAX_PREVIEWS
        : 0
    const previews: { text: string; kind: 'ev' | 'ts' }[] = []
    for (const t of evTitles) {
      if (previews.length >= MAX_PREVIEWS) break
      previews.push({ text: truncateTitle(t), kind: 'ev' })
    }
    for (const t of tsTitles) {
      if (previews.length >= MAX_PREVIEWS) break
      previews.push({ text: truncateTitle(t), kind: 'ts' })
    }

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
        <span className="text-xs font-semibold text-[var(--color-text-primary)]">{dayNum}</span>
        <div className="mt-1 flex flex-1 flex-col gap-0.5 overflow-hidden">
          {previews.map((p, i) => (
            <span
              key={`${p.kind}-${i}`}
              className={`block truncate text-[10px] leading-tight ${
                p.kind === 'ev' ? 'text-violet-200/90' : 'text-amber-200/90'
              }`}
            >
              {p.kind === 'ev' ? '◆ ' : '□ '}
              {p.text}
            </span>
          ))}
          {more > 0 && (
            <span className="text-[9px] font-medium text-[var(--color-text-muted)]">+{more} more</span>
          )}
        </div>
      </button>
    )
  }

  const layoutGridClass =
    viewMode === 'week'
      ? 'grid grid-cols-1 gap-6 xl:grid-cols-[1fr_minmax(280px,340px)]'
      : 'grid gap-6 lg:grid-cols-[1fr_minmax(280px,340px)]'

  return (
    <div className={layoutGridClass}>
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 rounded-lg border border-white/[0.08] p-0.5">
            {(
              [
                ['month', 'Month'],
                ['week', 'Week'],
                ['day', 'Day'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setViewMode(id)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                  viewMode === id
                    ? 'bg-sky-500/25 text-sky-100'
                    : 'text-[var(--color-text-muted)] hover:bg-white/[0.04]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedKey(todayKey)}
              className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-white/[0.04]"
            >
              Today
            </button>
            <button
              type="button"
              onClick={navPrev}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-white/[0.04]"
            >
              ←
            </button>
            <p className="min-w-[8rem] text-center text-sm font-semibold text-[var(--color-text-primary)]">
              {headerLabel}
            </p>
            <button
              type="button"
              onClick={navNext}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-white/[0.04]"
            >
              →
            </button>
          </div>
        </div>

        {viewMode === 'month' && (
          <>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-faint)]">
              {WEEK.map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthCells.map((day, i) => {
                if (day === null) {
                  return <div key={`e-${i}`} className="min-h-[4.5rem] rounded-lg bg-transparent" />
                }
                const key = dateKeyFromParts(displayYm, day)
                return renderMonthDayCell(key, day)
              })}
            </div>
          </>
        )}

        {viewMode === 'week' && (
          <div
            className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:thin] md:grid md:min-h-[min(68vh,820px)] md:grid-cols-7 md:gap-3 md:overflow-visible md:pb-0 md:snap-none [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15"
            role="list"
            aria-label="Week view, one column per day"
          >
            {weekDayKeys.map((key) => {
              const block = dayBlocks.get(key) ?? { events: [], tasks: [] }
              const sortedEv = sortEventsForDay(block.events, key)
              const wd = WEEK[new Date(key + 'T12:00:00').getDay()]
              const dom = new Date(key + 'T12:00:00').getDate()
              const isToday = key === todayKey
              const isSel = key === selectedKey
              return (
                <div
                  key={key}
                  role="listitem"
                  className={`flex h-[min(72vh,820px)] w-[min(152px,86vw)] shrink-0 snap-start flex-col overflow-hidden rounded-xl border md:h-full md:min-h-0 md:w-auto md:min-w-0 ${
                    isSel
                      ? 'border-sky-500/45 bg-sky-500/[0.08]'
                      : 'border-white/[0.08] bg-[var(--color-bg-panel)]/35'
                  } ${isToday ? 'ring-1 ring-sky-400/35' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedKey(key)}
                    className="shrink-0 border-b border-white/[0.06] px-2.5 py-2.5 text-left transition hover:bg-white/[0.03]"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
                      {wd}
                    </p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">
                      {dom}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">{key}</p>
                  </button>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                    {sortedEv.length === 0 && block.tasks.length === 0 && (
                      <p className="px-0.5 py-2 text-center text-[11px] text-[var(--color-text-muted)]">
                        Nothing
                      </p>
                    )}
                    {sortedEv.map((ev) => {
                      const time = eventTimeLabel(ev, key)
                      return (
                        <div
                          key={ev.id}
                          className="rounded-lg border border-violet-500/20 bg-violet-500/[0.12] px-2 py-2"
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-200/85">
                            {time || 'Event'}
                          </p>
                          <p className="mt-1 break-words text-xs font-medium leading-snug text-[var(--color-text-primary)]">
                            {ev.title.trim() || 'Untitled'}
                          </p>
                          {ev.recurrence ? (
                            <p className="mt-1 text-[10px] text-violet-200/65">
                              {recurrenceLabel(ev.recurrence.freq)}
                              {ev.recurrence.until ? ` · until ${ev.recurrence.until}` : ''}
                            </p>
                          ) : null}
                          {ev.location ? (
                            <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">{ev.location}</p>
                          ) : null}
                        </div>
                      )
                    })}
                    {block.tasks.map((t) => (
                      <Link
                        key={t.id}
                        href={`/boss/role/${t.roleId}`}
                        className="block rounded-lg border border-amber-500/25 bg-amber-500/[0.1] px-2 py-2 transition hover:border-amber-400/35 hover:bg-amber-500/[0.14]"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/80">
                          Task due
                        </p>
                        <p className="mt-1 break-words text-xs font-medium leading-snug text-[var(--color-text-primary)]">
                          {t.title.trim() || 'Untitled'}
                        </p>
                        <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                          {getRoleById(t.roleId)?.name ?? 'Role'}
                          {t.status === 'in_progress' ? ' · in progress' : ''}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {viewMode === 'day' && (
          <div className="rounded-xl border border-white/[0.06] bg-[var(--color-bg-panel)]/20 p-4">
            <div className="mb-4 flex flex-wrap gap-2 border-b border-white/[0.06] pb-3 text-xs text-[var(--color-text-muted)]">
              <span>
                {selectedBlock.events.length} event{selectedBlock.events.length === 1 ? '' : 's'}
              </span>
              <span>·</span>
              <span>
                {selectedTasks.length} task{selectedTasks.length === 1 ? '' : 's'} due
              </span>
            </div>
            <ul className="space-y-2">
              {selectedEventsSorted.map((ev) => {
                const disp = displayScheduleOnDay(ev, selectedKey)
                const time =
                  disp?.type === 'timed' && !Number.isNaN(disp.at.getTime())
                    ? disp.at.toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : disp?.type === 'continues'
                      ? 'All day (continues)'
                      : ''
                return (
                  <li
                    key={ev.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--color-text-primary)]">{ev.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                        {time}
                        {ev.location ? ` · ${ev.location}` : ''}
                        {ev.recurrence ? (
                          <span className="text-violet-200/80">
                            {' '}
                            · {recurrenceLabel(ev.recurrence.freq)}
                            {ev.recurrence.until ? ` until ${ev.recurrence.until}` : ''}
                          </span>
                        ) : null}
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
                )
              })}
              {selectedTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--color-text-primary)]">{t.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      Task · {getRoleById(t.roleId)?.name ?? 'Role'}
                      {t.status === 'in_progress' ? ' · in progress' : ''}
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
              {selectedEventsSorted.length === 0 && selectedTasks.length === 0 && (
                <p className="text-sm text-[var(--color-text-muted)]">Nothing on this day.</p>
              )}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {viewMode !== 'day' && (
          <div className="panel-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
              {selectedKey}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {selectedEventsSorted.map((ev) => {
                const disp = displayScheduleOnDay(ev, selectedKey)
                const time =
                  disp?.type === 'timed' && !Number.isNaN(disp.at.getTime())
                    ? disp.at.toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : disp?.type === 'continues'
                      ? 'Continues'
                      : ''
                return (
                  <li
                    key={ev.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-white/[0.06] bg-[var(--color-bg-deep)]/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--color-text-primary)]">{ev.title}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {time}
                        {ev.location ? ` · ${ev.location}` : ''}
                        {ev.recurrence ? (
                          <span className="text-violet-200/70">
                            {' '}
                            · {recurrenceLabel(ev.recurrence.freq)}
                          </span>
                        ) : null}
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
                )
              })}
              {selectedTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2"
                >
                  <div className="min-w-0">
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
              {selectedEventsSorted.length === 0 && selectedTasks.length === 0 && (
                <p className="text-sm text-[var(--color-text-muted)]">Nothing scheduled this day.</p>
              )}
            </ul>
          </div>
        )}

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
          <label className="block text-xs text-[var(--color-text-faint)]">
            Repeat
            <select
              value={evRecurrence}
              onChange={(e) => setEvRecurrence(e.target.value as 'none' | CalendarRecurrenceFreq)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm outline-none"
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          {evRecurrence !== 'none' && (
            <label className="block text-xs text-[var(--color-text-faint)]">
              End repeat (optional)
              <input
                type="date"
                value={evRecUntil}
                onChange={(e) => setEvRecUntil(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm outline-none"
              />
            </label>
          )}
          <input
            placeholder="Location (optional)"
            value={evLoc}
            onChange={(e) => setEvLoc(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm outline-none focus:border-sky-500/40"
          />
          <textarea
            placeholder="Notes (optional) — Boss sees calendar details in Focus when relevant"
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
