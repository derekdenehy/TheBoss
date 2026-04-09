'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { BOSS_MODULE_PRESETS } from '@/lib/bossModulePresets'
import { useAppState } from '@/context/AppStateContext'
import type { BossTab } from './bossDashboardTabs'
import { KpiSparkline } from './KpiSparkline'

type Props = {
  setTab: (t: BossTab) => void
}

export function BossOverviewTab({ setTab }: Props) {
  const {
    kpiDefinitions,
    kpiEntries,
    bossDashboardModules,
    addBossDashboardModule,
    updateBossDashboardModule,
    deleteBossDashboardModule,
    moveBossDashboardModule,
    isBossDayCommitted,
    todayBossRoutine,
    getRoleById,
    getActiveSessions,
  } = useAppState()

  const modulesSorted = useMemo(
    () => [...bossDashboardModules].sort((a, b) => a.sortOrder - b.sortOrder),
    [bossDashboardModules]
  )

  const roleRunOrder = useMemo(() => {
    const r = todayBossRoutine
    if (!r?.committedAt || r.activeRoleIds.length < 1) return null
    const start = r.startingRoleId
    const ordered =
      start && r.activeRoleIds.includes(start)
        ? [start, ...r.activeRoleIds.filter((id) => id !== start)]
        : [...r.activeRoleIds]
    return ordered.map((id, index) => ({
      id,
      role: getRoleById(id),
      step: index + 1,
      isStart: id === start,
      switchText: (r.switchConditions[id] ?? '').trim(),
    }))
  }, [todayBossRoutine, getRoleById])

  const clockedSessions = getActiveSessions()

  return (
    <div className="space-y-8">
      {roleRunOrder ? (
        <section className="panel-card border-sky-500/20 bg-sky-500/[0.04] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Today&apos;s role order
              </h2>
              <p className="mt-1 max-w-xl text-xs text-[var(--color-text-muted)]">
                Start with the first role, then move down the list. Each line uses your{' '}
                <strong className="font-medium text-[var(--color-text-primary)]">switch rule</strong>{' '}
                as the cue for when to change hats. Order matches Planning (start role first, then the
                sequence you picked).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTab('planning')}
              className="shrink-0 text-xs font-medium text-sky-300 hover:underline"
            >
              Edit in Planning →
            </button>
          </div>
          {todayBossRoutine?.stateCheck.workingTime?.trim() && (
            <p className="mt-3 rounded-lg border border-white/[0.06] bg-[var(--color-bg-deep)]/60 px-3 py-2 text-xs text-[var(--color-text-muted)]">
              <span className="font-medium text-[var(--color-text-faint)]">Working window · </span>
              {todayBossRoutine.stateCheck.workingTime.trim()}
            </p>
          )}
          <ol className="mt-4 space-y-3">
            {roleRunOrder.map(({ id, role, step, isStart, switchText }) => (
              <li
                key={id}
                className="flex gap-3 rounded-xl border border-white/[0.06] bg-[var(--color-bg-deep)]/40 px-3 py-3 sm:gap-4"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-xs font-bold text-[var(--color-text-muted)]"
                  aria-hidden
                >
                  {step}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/boss/role/${id}`}
                      className="text-sm font-semibold text-sky-200 hover:underline"
                    >
                      {role?.name ?? 'Role'}
                    </Link>
                    {isStart && (
                      <span className="rounded-md bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200/90">
                        Start here
                      </span>
                    )}
                  </div>
                  {switchText ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
                      <span className="text-[var(--color-text-faint)]">Switch when · </span>
                      {switchText}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[11px] text-[var(--color-text-faint)]">
                      No switch rule yet — add one in Planning so you know when to leave this role.
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {clockedSessions.length > 0 && (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
                On the clock now
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {clockedSessions.map((se) => {
                  const ro = getRoleById(se.roleId)
                  return (
                    <li key={se.id}>
                      <Link
                        href={`/boss/role/${se.roleId}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-200/95 hover:border-emerald-400/50"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: ro?.color ?? '#34d399' }}
                        />
                        {ro?.name ?? 'Role'}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <section className="panel-card border-dashed border-white/15 p-5">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Today&apos;s role order
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Commit your day in <strong className="text-[var(--color-text-primary)]">Planning</strong>{' '}
            to get a numbered run order, start role, and switch rules on this screen.
          </p>
          <button
            type="button"
            onClick={() => setTab('planning')}
            className="mt-4 rounded-xl bg-sky-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
          >
            Open Planning
          </button>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">KPIs</h2>
          <button
            type="button"
            onClick={() => setTab('kpis')}
            className="text-xs font-medium text-sky-300 hover:underline"
          >
            Manage KPIs →
          </button>
        </div>
        {kpiDefinitions.length === 0 ? (
          <div className="panel-card px-5 py-8 text-center text-sm text-[var(--color-text-muted)]">
            No KPIs yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {kpiDefinitions.map((k) => {
              const series = kpiEntries.filter((e) => e.kpiId === k.id)
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setTab('kpis')}
                  className="panel-card w-full p-4 text-left transition hover:border-sky-500/25"
                >
                  <p className="text-xs font-medium text-[var(--color-text-primary)]">{k.label}</p>
                  <div className="mt-3">
                    <KpiSparkline entries={series} color={k.color ?? '#38bdf8'} />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Steps</h2>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-2 py-2 text-xs text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value
                e.target.value = ''
                if (v === '__blank') {
                  addBossDashboardModule({ title: 'New step', body: '', templateKey: 'custom' })
                  return
                }
                const preset = BOSS_MODULE_PRESETS.find((p) => p.templateKey === v)
                if (preset) {
                  addBossDashboardModule({
                    title: preset.title,
                    body: preset.defaultBody,
                    templateKey: preset.templateKey,
                  })
                }
              }}
            >
              <option value="">+ Add step…</option>
              <option value="__blank">Blank card</option>
              {BOSS_MODULE_PRESETS.map((p) => (
                <option key={p.templateKey} value={p.templateKey}>
                  Template: {p.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {modulesSorted.length === 0 ? (
          <div className="panel-card px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">
            No steps yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {modulesSorted.map((m, idx) => (
              <div key={m.id} className="panel-card flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <input
                    className="min-w-0 flex-1 border-b border-transparent bg-transparent text-sm font-semibold text-[var(--color-text-primary)] outline-none focus:border-sky-500/30"
                    value={m.title}
                    onChange={(e) => updateBossDashboardModule(m.id, { title: e.target.value })}
                    aria-label="Step title"
                  />
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveBossDashboardModule(m.id, 'up')}
                      className="rounded px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-white/[0.06] disabled:opacity-30"
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      disabled={idx === modulesSorted.length - 1}
                      onClick={() => moveBossDashboardModule(m.id, 'down')}
                      className="rounded px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-white/[0.06] disabled:opacity-30"
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteBossDashboardModule(m.id)}
                      className="rounded px-2 py-1 text-xs text-rose-300/90 hover:bg-rose-500/10"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {m.templateKey && m.templateKey !== 'custom' && (
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--color-text-faint)]">
                    template · {m.templateKey.replace(/_/g, ' ')}
                  </p>
                )}
                <textarea
                  className="mt-3 min-h-[6rem] w-full resize-y rounded-xl border border-white/[0.06] bg-[var(--color-bg-deep)]/80 px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/35"
                  placeholder="Your notes for this step…"
                  value={m.body}
                  onChange={(e) => updateBossDashboardModule(m.id, { body: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel-card p-5">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Planning</h2>
        <button
          type="button"
          onClick={() => setTab('planning')}
          className="mt-3 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-white/[0.1]"
        >
          Open planning →
        </button>
      </section>
    </div>
  )
}
