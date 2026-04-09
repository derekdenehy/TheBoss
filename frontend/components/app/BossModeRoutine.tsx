'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { getTodayKey } from '@/lib/dailyBoss'
import { useAppState } from '@/context/AppStateContext'

function padOutcomes(raw: string[] | undefined): [string, string, string] {
  const a = [...(raw ?? [])]
  while (a.length < 3) a.push('')
  return [a[0] ?? '', a[1] ?? '', a[2] ?? '']
}

export function BossModeRoutine() {
  const {
    roles,
    bossDailyRoutine,
    beginBossDayForToday,
    setBossDailyRoutine,
    commitBossDailyTaskPackets,
    todayBossRoutine,
    isBossDayCommitted,
  } = useAppState()

  const [commitError, setCommitError] = useState<string | null>(null)
  const today = getTodayKey()

  const stalePlan =
    bossDailyRoutine !== null && bossDailyRoutine.date !== today

  const routine = todayBossRoutine
  const sortedRoles = useMemo(
    () => [...roles].sort((a, b) => a.name.localeCompare(b.name)),
    [roles]
  )

  const [o1, o2, o3] = padOutcomes(routine?.outcomes)

  const setOutcome = (index: 0 | 1 | 2, value: string) => {
    setBossDailyRoutine((d) => {
      const cur = padOutcomes(d.outcomes)
      cur[index] = value
      return { ...d, outcomes: cur }
    })
  }

  const toggleActiveRole = (roleId: string) => {
    setBossDailyRoutine((d) => {
      const has = d.activeRoleIds.includes(roleId)
      if (has) {
        const next = d.activeRoleIds.filter((id) => id !== roleId)
        return {
          ...d,
          activeRoleIds: next,
          startingRoleId:
            d.startingRoleId && next.includes(d.startingRoleId) ? d.startingRoleId : null,
        }
      }
      if (d.activeRoleIds.length >= 3) return d
      return {
        ...d,
        activeRoleIds: [...d.activeRoleIds, roleId],
        rolePackets: {
          ...d.rolePackets,
          [roleId]: d.rolePackets[roleId] ?? { frictionNote: '', taskLines: [''] },
        },
      }
    })
  }

  const setPacketLine = (roleId: string, lineIndex: number, value: string) => {
    setBossDailyRoutine((d) => {
      const pack = d.rolePackets[roleId] ?? { frictionNote: '', taskLines: [''] }
      const lines = [...pack.taskLines]
      while (lines.length <= lineIndex) lines.push('')
      lines[lineIndex] = value
      return {
        ...d,
        rolePackets: { ...d.rolePackets, [roleId]: { ...pack, taskLines: lines } },
      }
    })
  }

  const addPacketLine = (roleId: string) => {
    setBossDailyRoutine((d) => {
      const pack = d.rolePackets[roleId] ?? { frictionNote: '', taskLines: [''] }
      return {
        ...d,
        rolePackets: {
          ...d.rolePackets,
          [roleId]: { ...pack, taskLines: [...pack.taskLines, ''] },
        },
      }
    })
  }

  const removePacketLine = (roleId: string, lineIndex: number) => {
    setBossDailyRoutine((d) => {
      const pack = d.rolePackets[roleId] ?? { frictionNote: '', taskLines: [''] }
      const lines = pack.taskLines.filter((_, i) => i !== lineIndex)
      return {
        ...d,
        rolePackets: {
          ...d.rolePackets,
          [roleId]: { ...pack, taskLines: lines.length ? lines : [''] },
        },
      }
    })
  }

  const setFriction = (roleId: string, frictionNote: string) => {
    setBossDailyRoutine((d) => {
      const pack = d.rolePackets[roleId] ?? { frictionNote: '', taskLines: [''] }
      return {
        ...d,
        rolePackets: { ...d.rolePackets, [roleId]: { ...pack, frictionNote } },
      }
    })
  }

  const setSwitch = (roleId: string, text: string) => {
    setBossDailyRoutine((d) => ({
      ...d,
      switchConditions: { ...d.switchConditions, [roleId]: text },
    }))
  }

  const handleCommit = () => {
    setCommitError(null)
    const res = commitBossDailyTaskPackets()
    if (!res.ok) setCommitError(res.error)
  }

  if (roles.length === 0) {
    return null
  }

  return (
    <div className="mt-10 space-y-8">
      {stalePlan && (
        <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          <p className="font-medium text-amber-50">Plan is from another calendar day</p>
          <p className="mt-1 text-amber-100/85">
            Boss Mode is meant to be quick each morning. Start fresh for today.
          </p>
          <button
            type="button"
            onClick={() => beginBossDayForToday()}
            className="mt-3 rounded-xl bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
          >
            Start today&apos;s Boss Mode
          </button>
        </div>
      )}

      {!stalePlan && routine === null && (
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-6 py-8 text-center">
          <p className="text-sm font-medium text-sky-100">Boss Mode</p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            You don&apos;t delegate work from here—you set up 2–3 roles with tiny, concrete task
            packets so each role can start with no friction.
          </p>
          <button
            type="button"
            onClick={() => beginBossDayForToday()}
            className="mt-6 rounded-2xl bg-sky-500/90 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-sky-400"
          >
            Start today&apos;s Boss Mode
          </button>
        </div>
      )}

      {!stalePlan && routine && isBossDayCommitted && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200/90">
            Today&apos;s plan is locked in
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-emerald-50/95">
            {routine.outcomes
              .map((o) => o.trim())
              .filter(Boolean)
              .map((o, i) => (
                <li key={`${i}-${o}`}>{o}</li>
              ))}
          </ul>
          <p className="mt-4 text-xs text-[var(--color-text-muted)]">
            Active roles:{' '}
            {routine.activeRoleIds
              .map((id) => sortedRoles.find((r) => r.id === id)?.name ?? id)
              .join(' · ')}
          </p>
          {routine.startingRoleId && (
            <Link
              href={`/boss/role/${routine.startingRoleId}`}
              className="mt-5 inline-flex rounded-xl bg-emerald-500/90 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400"
            >
              Open starting role
            </Link>
          )}
          <div className="mt-6 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => {
                const ok = window.confirm(
                  'Discard today’s committed plan in Boss Mode and start the checklist over? Tasks already created stay on your lists.'
                )
                if (ok) beginBossDayForToday()
              }}
              className="text-xs text-rose-300/90 hover:underline"
            >
              Reset Boss Mode for today…
            </button>
          </div>
        </div>
      )}

      {!stalePlan && routine && !isBossDayCommitted && (
        <>
          <section className="panel-card p-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              1 · State check
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Fast snapshot—unfinished, urgent, blocked, energy, time.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-[var(--color-text-faint)]">
                Unfinished from yesterday
                <textarea
                  className="mt-1 min-h-[4rem] w-full rounded-xl border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
                  value={routine.stateCheck.unfinishedFromYesterday}
                  onChange={(e) =>
                    setBossDailyRoutine((d) => ({
                      ...d,
                      stateCheck: { ...d.stateCheck, unfinishedFromYesterday: e.target.value },
                    }))
                  }
                />
              </label>
              <label className="block text-xs text-[var(--color-text-faint)]">
                Urgent
                <textarea
                  className="mt-1 min-h-[4rem] w-full rounded-xl border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
                  value={routine.stateCheck.urgent}
                  onChange={(e) =>
                    setBossDailyRoutine((d) => ({
                      ...d,
                      stateCheck: { ...d.stateCheck, urgent: e.target.value },
                    }))
                  }
                />
              </label>
              <label className="block text-xs text-[var(--color-text-faint)]">
                Blocked
                <textarea
                  className="mt-1 min-h-[4rem] w-full rounded-xl border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
                  value={routine.stateCheck.blocked}
                  onChange={(e) =>
                    setBossDailyRoutine((d) => ({
                      ...d,
                      stateCheck: { ...d.stateCheck, blocked: e.target.value },
                    }))
                  }
                />
              </label>
              <label className="block text-xs text-[var(--color-text-faint)]">
                Working time today
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
                  placeholder="e.g. 3h deep + meetings"
                  value={routine.stateCheck.workingTime}
                  onChange={(e) =>
                    setBossDailyRoutine((d) => ({
                      ...d,
                      stateCheck: { ...d.stateCheck, workingTime: e.target.value },
                    }))
                  }
                />
              </label>
            </div>
            <label className="mt-3 block text-xs text-[var(--color-text-faint)]">
              Energy / focus
              <select
                className="mt-1 w-full max-w-xs rounded-xl border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
                value={routine.stateCheck.energy}
                onChange={(e) =>
                  setBossDailyRoutine((d) => ({
                    ...d,
                    stateCheck: {
                      ...d.stateCheck,
                      energy: e.target.value as '' | 'low' | 'medium' | 'high',
                    },
                  }))
                }
              >
                <option value="">—</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </section>

          <section className="panel-card p-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              2 · Daily outcomes
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              1–3 results that would make today a win—not a giant backlog.
            </p>
            <div className="mt-4 space-y-2">
              {([0, 1, 2] as const).map((i) => (
                <input
                  key={i}
                  className="w-full rounded-xl border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
                  placeholder={i === 0 ? 'e.g. Ship one meaningful app fix' : `Outcome ${i + 1} (optional)`}
                  value={i === 0 ? o1 : i === 1 ? o2 : o3}
                  onChange={(e) => setOutcome(i, e.target.value)}
                />
              ))}
            </div>
          </section>

          <section className="panel-card p-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              3 · Active roles today
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Turn on 1–3 roles only. Boss Mode stays separate—you&apos;re not doing their work here.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {sortedRoles.map((role) => {
                const on = routine.activeRoleIds.includes(role.id)
                const atCap = routine.activeRoleIds.length >= 3 && !on
                return (
                  <button
                    key={role.id}
                    type="button"
                    disabled={atCap}
                    onClick={() => toggleActiveRole(role.id)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      on
                        ? 'border-sky-500/50 bg-sky-500/20 text-sky-100'
                        : atCap
                          ? 'cursor-not-allowed border-white/5 text-[var(--color-text-faint)]'
                          : 'border-white/15 text-[var(--color-text-muted)] hover:border-white/25'
                    }`}
                  >
                    <span
                      className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                      style={{ backgroundColor: role.color || '#64748b' }}
                    />
                    {role.name}
                  </button>
                )
              })}
            </div>
          </section>

          {routine.activeRoleIds.map((roleId) => {
            const role = sortedRoles.find((r) => r.id === roleId)
            if (!role) return null
            const pack = routine.rolePackets[roleId] ?? { frictionNote: '', taskLines: [''] }
            const lines = pack.taskLines.length ? pack.taskLines : ['']
            return (
              <section key={roleId} className="panel-card p-6">
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                  4–5 · Task packet · {role.name}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Tiny executable steps. Remove friction so this role can start instantly.
                </p>
                <label className="mt-4 block text-xs text-[var(--color-text-faint)]">
                  Friction removal (files, links, first click)
                  <textarea
                    className="mt-1 min-h-[4rem] w-full rounded-xl border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
                    placeholder="What does this role need within arm’s reach?"
                    value={pack.frictionNote}
                    onChange={(e) => setFriction(roleId, e.target.value)}
                  />
                </label>
                <p className="mt-4 text-xs font-medium text-[var(--color-text-faint)]">Concrete tasks</p>
                <ul className="mt-2 space-y-2">
                  {lines.map((line, idx) => (
                    <li key={idx} className="flex gap-2">
                      <input
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
                        placeholder="Specific next action…"
                        value={line}
                        onChange={(e) => setPacketLine(roleId, idx, e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removePacketLine(roleId, idx)}
                        className="shrink-0 rounded-lg px-2 text-xs text-rose-300/90 hover:bg-rose-500/10"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => addPacketLine(roleId)}
                  className="mt-2 text-xs font-medium text-sky-300 hover:underline"
                >
                  + Add task line
                </button>
              </section>
            )
          })}

          {routine.activeRoleIds.length > 0 && (
            <section className="panel-card p-6">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                6 · Starting role
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Best energy window, clearest momentum, or top bottleneck—pick one to open first.
              </p>
              <div className="mt-4 space-y-2">
                {routine.activeRoleIds.map((roleId) => {
                  const role = sortedRoles.find((r) => r.id === roleId)
                  if (!role) return null
                  return (
                    <label
                      key={roleId}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 px-4 py-3 hover:bg-white/[0.03]"
                    >
                      <input
                        type="radio"
                        name="startingRole"
                        checked={routine.startingRoleId === roleId}
                        onChange={() =>
                          setBossDailyRoutine((d) => ({ ...d, startingRoleId: roleId }))
                        }
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-[var(--color-text-primary)]">{role.name}</span>
                    </label>
                  )
                })}
              </div>
            </section>
          )}

          {routine.activeRoleIds.length > 0 && (
            <section className="panel-card p-6">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                7 · Switch conditions
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                No rigid time blocks—define when to leave this role or return to Boss Mode.
              </p>
              <div className="mt-4 space-y-4">
                {routine.activeRoleIds.map((roleId) => {
                  const role = sortedRoles.find((r) => r.id === roleId)
                  if (!role) return null
                  return (
                    <label key={roleId} className="block text-xs text-[var(--color-text-faint)]">
                      {role.name}
                      <textarea
                        className="mt-1 min-h-[4rem] w-full rounded-xl border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
                        placeholder="e.g. Finish this packet → switch. Stuck or drained → Boss Mode."
                        value={routine.switchConditions[roleId] ?? ''}
                        onChange={(e) => setSwitch(roleId, e.target.value)}
                      />
                    </label>
                  )
                })}
              </div>
            </section>
          )}

          {commitError && (
            <p className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {commitError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCommit}
              className="rounded-2xl bg-sky-500/90 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-sky-400"
            >
              Commit plan &amp; create task packets
            </button>
            <p className="text-xs text-[var(--color-text-muted)]">
              Creates to-dos on each role. Sidebar will show only today&apos;s active roles.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
