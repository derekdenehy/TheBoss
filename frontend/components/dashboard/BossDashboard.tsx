'use client'

import { useState } from 'react'
import { ActiveSessionsStrip } from '../app/ActiveSessionsStrip'
import { BossModeRoutine } from '../app/BossModeRoutine'
import { CurrencyBadge } from '../app/CurrencyBadge'
import { useAppState } from '@/context/AppStateContext'
import { formatCoins, formatDuration } from '@/lib/earnings'
import { DEFAULT_HOURLY_RATE } from '@/lib/types'
import type { BossTab } from './bossDashboardTabs'
import { BossCalendarTab } from './BossCalendarTab'
import { BossKpisTab } from './BossKpisTab'
import { BossOverviewTab } from './BossOverviewTab'
import { BossRolesTab } from './BossRolesTab'
import { BossTasksTab } from './BossTasksTab'

const TABS: { id: BossTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'roles', label: 'Roles' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'kpis', label: 'KPIs' },
  { id: 'planning', label: 'Planning' },
]

export function BossDashboard() {
  const [tab, setTab] = useState<BossTab>('overview')
  const {
    hydrated,
    roles,
    liveTotalCurrency,
    liveBossWindowSeconds,
    liveBossWindowStintEarnings,
  } = useAppState()

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--color-text-muted)]">
        Loading…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-2 sm:px-6">
      <header className="flex flex-col gap-3 border-b border-white/[0.06] pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-2xl">
            Boss
          </h1>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            <span className="text-[var(--color-text-faint)]">Workspace</span>{' '}
            <span className="font-mono tabular-nums text-[var(--color-text-muted)]">
              {formatDuration(liveBossWindowSeconds())}
            </span>
            <span className="mx-1.5 text-white/15">·</span>
            <span className="text-amber-200/70">
              +{formatCoins(liveBossWindowStintEarnings())} this visit
            </span>
            <span className="mx-1.5 text-white/15">·</span>
            <span>{DEFAULT_HOURLY_RATE} coins/hr</span>
          </p>
        </div>
        <CurrencyBadge amount={liveTotalCurrency()} />
      </header>

      <div className="mt-6">
        <ActiveSessionsStrip />
      </div>

      {roles.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-white/[0.06] bg-[var(--color-bg-panel)]/40 px-8 py-12 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            No roles yet. Use <strong className="text-[var(--color-text-primary)]">+ New role</strong>{' '}
            in the sidebar.
          </p>
        </div>
      ) : (
        <>
          <nav
            className="mt-8 flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Sections"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  tab === t.id
                    ? 'boss-dash-tab-active'
                    : 'text-[var(--color-text-muted)] hover:bg-white/[0.04] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="mt-8">
            {tab === 'overview' && <BossOverviewTab setTab={setTab} />}
            {tab === 'roles' && <BossRolesTab />}
            {tab === 'tasks' && <BossTasksTab />}
            {tab === 'calendar' && <BossCalendarTab />}
            {tab === 'kpis' && <BossKpisTab />}
            {tab === 'planning' && <BossModeRoutine />}
          </div>
        </>
      )}
    </div>
  )
}
