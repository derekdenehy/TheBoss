'use client'

import { useState } from 'react'
import { useAppState } from '@/context/AppStateContext'
import { formatCoins, formatDuration } from '@/lib/earnings'
import { DEFAULT_HOURLY_RATE } from '@/lib/types'
import type { BossTab } from './bossDashboardTabs'
import { BossBriefTab } from './BossBriefTab'
import { BossCalendarTab } from './BossCalendarTab'
import { BossChatTab } from './BossChatTab'
import { BossKpisTab } from './BossKpisTab'

const TABS: { id: BossTab; label: string }[] = [
  { id: 'chat', label: 'Focus' },
  { id: 'brief', label: 'Brief' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'kpis', label: 'KPIs' },
]

export function BossDashboard() {
  const [tab, setTab] = useState<BossTab>('chat')
  const {
    hydrated,
    roles,
    liveBossWindowSeconds,
    liveBossWindowStintEarnings,
    aiContext,
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
      <header className="border-b border-white/[0.06] pb-6">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-2xl">
            Boss
          </h1>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            <span className="text-[var(--color-text-faint)]">Workspace</span>{' '}
            <span className="font-mono tabular-nums text-[var(--color-text-muted)]">
              {formatDuration(liveBossWindowSeconds())}
            </span>
            <span className="mx-1.5 text-white/15">·</span>
            <span className="text-emerald-200/70">
              +{formatCoins(liveBossWindowStintEarnings())} dollars this visit
            </span>
            <span className="mx-1.5 text-white/15">·</span>
            <span>{DEFAULT_HOURLY_RATE} dollars/hr</span>
          </p>
          {aiContext.goals.mainGoal.trim() && (
            <p className="mt-3 max-w-2xl text-sm leading-snug text-[var(--color-text-muted)]">
              <span className="text-[var(--color-text-faint)]">North star intent · </span>
              <span className="text-[var(--color-text-primary)]">{aiContext.goals.mainGoal.trim()}</span>
              {aiContext.goals.currentPriority.trim() && (
                <>
                  <span className="text-white/20"> · </span>
                  <span>{aiContext.goals.currentPriority.trim()}</span>
                </>
              )}
            </p>
          )}
        </div>
      </header>

      {roles.length === 0 && (
        <div className="mt-6 rounded-xl border border-white/[0.06] bg-[var(--color-bg-panel)]/40 px-4 py-3 text-center text-sm text-[var(--color-text-muted)]">
          No roles yet. Use <strong className="text-[var(--color-text-primary)]">+ New role</strong> in
          the sidebar to track work by hat. You can still use <strong className="text-[var(--color-text-primary)]">Focus</strong>{' '}
          with AI Studio context alone.
        </div>
      )}

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
        {tab === 'chat' && <BossChatTab onOpenBrief={() => setTab('brief')} />}
        {tab === 'brief' && <BossBriefTab setTab={setTab} />}
        {tab === 'calendar' && <BossCalendarTab />}
        {tab === 'kpis' && <BossKpisTab />}
      </div>
    </div>
  )
}
