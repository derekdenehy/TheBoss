'use client'

import { useMemo, useState } from 'react'
import { useAppState } from '@/context/AppStateContext'
import { ConversationalOnboarding } from '@/components/app/ConversationalOnboarding'
import { eventsTouchingLocalDay } from '@/lib/calendarDay'
import { getTodayKey } from '@/lib/dailyBoss'
import { formatCoins, formatDuration } from '@/lib/earnings'
import { DEFAULT_HOURLY_RATE } from '@/lib/types'
import type { BossTab } from './bossDashboardTabs'
import { BossCalendarTab } from './BossCalendarTab'
import { BossChatTab } from './BossChatTab'
import { BossGlobalTodosTab } from './BossGlobalTodosTab'
import { BossKpisTab } from './BossKpisTab'

const TABS: { id: BossTab; label: string }[] = [
  { id: 'todos', label: 'To-dos' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'kpis', label: 'KPIs' },
]

export function BossDashboard() {
  const [tab, setTab] = useState<BossTab>('todos')
  const [saveBannerDismissed, setSaveBannerDismissed] = useState(false)
  const {
    hydrated,
    roles,
    liveBossWindowSeconds,
    liveBossWindowStintEarnings,
    aiContext,
    aiContextSetupComplete,
    calendarEvents,
    supabaseConfigured,
    authUser,
  } = useAppState()

  const todayYmd = getTodayKey()
  const calendarToday = useMemo(
    () => eventsTouchingLocalDay(calendarEvents, todayYmd),
    [calendarEvents, todayYmd]
  )

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--color-text-muted)]">
        Loading…
      </div>
    )
  }

  // New user — show onboarding chat inside the full boss layout
  if (!aiContextSetupComplete) {
    return (
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-2 sm:px-6">
        <header className="border-b border-white/[0.06] pb-6">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-2xl">
            Boss
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Let&apos;s get you set up before anything else.
          </p>
        </header>

        {/* Tab bar visible but locked — shows what's coming */}
        <nav
          className="mt-8 flex gap-1 overflow-x-auto pb-1 opacity-30 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-hidden
        >
          {TABS.map((t) => (
            <div
              key={t.id}
              className="shrink-0 cursor-not-allowed rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--color-text-muted)]"
            >
              {t.label}
            </div>
          ))}
        </nav>

        <div className="mt-8">
          <ConversationalOnboarding />
        </div>
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

      {supabaseConfigured && !authUser && !saveBannerDismissed && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm">
          <p className="text-sky-100/90">
            Your setup is saved on this device.{' '}
            <a href="/login" className="font-medium text-sky-300 underline-offset-2 hover:underline">
              Sign in
            </a>{' '}
            to keep it synced and message Boss above.
          </p>
          <button
            type="button"
            onClick={() => setSaveBannerDismissed(true)}
            className="shrink-0 text-sky-300/60 hover:text-sky-200"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {calendarToday.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          <p className="font-medium text-amber-50/95">Something on your calendar today</p>
          <ul className="mt-2 list-inside list-disc text-amber-100/85">
            {calendarToday.map((e) => (
              <li key={e.id}>{e.title.trim() || 'Event'}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-100/75">
            <strong className="font-medium text-amber-50/90">Message Boss</strong> above — Boss can nudge you to
            start (e.g. an assignment due tonight) without extra decisions from you.
          </p>
        </div>
      )}

      {roles.length === 0 && (
        <div className="mt-6 rounded-xl border border-white/[0.06] bg-[var(--color-bg-panel)]/40 px-4 py-3 text-center text-sm text-[var(--color-text-muted)]">
          No roles yet. Use <strong className="text-[var(--color-text-primary)]">+ New role</strong> in
          the sidebar to track work by hat. You can still message <strong className="text-[var(--color-text-primary)]">Boss</strong>{' '}
          above with your saved context.
        </div>
      )}

      <div className="mt-8">
        <BossChatTab />
      </div>

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
        {tab === 'todos' && <BossGlobalTodosTab />}
        {tab === 'calendar' && <BossCalendarTab />}
        {tab === 'kpis' && <BossKpisTab />}
      </div>
    </div>
  )
}
