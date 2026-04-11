'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useAppState } from '@/context/AppStateContext'
import type { AIContext } from '@/lib/types'
import type { BossTab } from './bossDashboardTabs'

function contextHasBody(ctx: AIContext): boolean {
  const ws = ctx.workingState
  const wsAny =
    ws.inProgress.length +
      ws.urgent.length +
      ws.blocked.length +
      ws.avoiding.length >
    0
  const goalsAny =
    ctx.goals.mainGoal.trim() !== '' ||
    ctx.goals.currentPriority.trim() !== '' ||
    (ctx.goals.secondaryPriority?.trim() ?? '') !== ''
  const projAny = ctx.projects.some(
    (p) =>
      p.name.trim() !== '' ||
      p.summary.trim() !== '' ||
      p.phase.trim() !== '' ||
      p.workstreams.length > 0 ||
      (p.bottleneck?.trim() ?? '') !== ''
  )
  const profAny =
    ctx.profile.roles.length > 0 ||
    ctx.profile.preferredTaskStyle.trim() !== '' ||
    ctx.profile.preferredWarmup.trim() !== '' ||
    ctx.profile.commonBlockers.length > 0
  return wsAny || goalsAny || projAny || profAny
}

const LIST_EMPTY = 'Nothing listed yet.'

type Props = {
  setTab: (t: BossTab) => void
}

export function BossContextBrief({ setTab }: Props) {
  const { aiContext, aiContextSetupComplete } = useAppState()

  const filled = useMemo(() => contextHasBody(aiContext), [aiContext])

  if (!aiContextSetupComplete && !filled) {
    return (
      <section className="panel-card border-amber-500/20 bg-amber-500/[0.06] p-5">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Your Boss brief
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-muted)]">
          This panel is the declarative “brain” for your day: what&apos;s live now, what matters, which
          projects, and how you like work phrased — the same structure the Chat assistant uses.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/boss/context"
            className="inline-flex items-center justify-center rounded-xl bg-sky-500/90 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
          >
            Quick setup
          </Link>
          <button
            type="button"
            onClick={() => setTab('chat')}
            className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium text-[var(--color-text-muted)] hover:bg-white/[0.04]"
          >
            Chat anyway
          </button>
        </div>
      </section>
    )
  }

  if (!filled) {
    return (
      <section className="panel-card border-dashed border-white/15 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Your Boss brief
            </h2>
            <p className="mt-1 max-w-xl text-xs text-[var(--color-text-muted)]">
              Add goals, projects, and working state in AI Studio — they show up here and power Chat.
            </p>
          </div>
          <Link
            href="/boss/context"
            className="shrink-0 text-xs font-medium text-sky-300 hover:underline"
          >
            AI Studio →
          </Link>
        </div>
      </section>
    )
  }

  const { workingState: ws, goals, projects, profile } = aiContext

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Your Boss brief</h2>
          <p className="mt-1 max-w-2xl text-xs text-[var(--color-text-muted)]">
            Read top to bottom: <strong className="font-medium text-[var(--color-text-primary)]">now</strong>{' '}
            → <strong className="font-medium text-[var(--color-text-primary)]">strategy</strong> →{' '}
            <strong className="font-medium text-[var(--color-text-primary)]">projects</strong> →{' '}
            <strong className="font-medium text-[var(--color-text-primary)]">style</strong>. Same order
            the assistant uses.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/boss/context"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-sky-300/90 hover:bg-white/[0.04]"
          >
            Edit in AI Studio
          </Link>
          <button
            type="button"
            onClick={() => setTab('chat')}
            className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-white/[0.12]"
          >
            Ask Boss in Chat
          </button>
        </div>
      </div>

      {/* 1. Working state — what’s live now */}
      <div className="panel-card border-violet-500/15 bg-violet-500/[0.04] p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-200/85">
          Right now
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <WorkingList label="In progress" items={ws.inProgress} tone="emerald" />
          <WorkingList label="Urgent" items={ws.urgent} tone="amber" />
          <WorkingList label="Blocked" items={ws.blocked} tone="rose" />
          <WorkingList label="Avoiding" items={ws.avoiding} tone="slate" />
        </div>
        <p className="mt-3 text-[10px] text-[var(--color-text-faint)]">
          In progress syncs from task statuses; edit the rest in AI Studio or keep working — Chat sees
          this snapshot when you send a message. Simple rule: tackle{' '}
          <strong className="font-medium text-[var(--color-text-muted)]">urgent</strong> first, then keep{' '}
          <strong className="font-medium text-[var(--color-text-muted)]">in progress</strong> moving, and
          name what&apos;s <strong className="font-medium text-[var(--color-text-muted)]">blocked</strong>{' '}
          so it stops looping in your head.
        </p>
      </div>

      {/* 2. Goals */}
      <div className="panel-card border-sky-500/15 bg-sky-500/[0.03] p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-200/85">
          What matters
        </h3>
        <div className="mt-3 space-y-2">
          {goals.mainGoal.trim() ? (
            <p className="text-base font-semibold text-[var(--color-text-primary)]">{goals.mainGoal}</p>
          ) : (
            <p className="text-sm text-[var(--color-text-faint)]">No main goal set.</p>
          )}
          {goals.currentPriority.trim() && (
            <p className="text-sm text-[var(--color-text-muted)]">
              <span className="text-[var(--color-text-faint)]">Current priority · </span>
              {goals.currentPriority}
            </p>
          )}
          {goals.secondaryPriority?.trim() && (
            <p className="text-sm text-[var(--color-text-muted)]">
              <span className="text-[var(--color-text-faint)]">Secondary · </span>
              {goals.secondaryPriority}
            </p>
          )}
        </div>
      </div>

      {/* 3. Projects */}
      <div className="panel-card p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Active projects
        </h3>
        {projects.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-text-faint)]">No projects in context yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {projects.map((p, i) => (
              <li
                key={`${p.name}-${i}`}
                className="rounded-xl border border-white/[0.06] bg-[var(--color-bg-deep)]/50 px-4 py-3"
              >
                <p className="font-medium text-[var(--color-text-primary)]">{p.name || 'Untitled'}</p>
                {p.phase.trim() && (
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--color-text-faint)]">
                    {p.phase}
                  </p>
                )}
                {p.summary.trim() && (
                  <p className="mt-2 text-sm text-[var(--color-text-muted)]">{p.summary}</p>
                )}
                {p.workstreams.length > 0 && (
                  <p className="mt-2 text-xs text-[var(--color-text-faint)]">
                    Workstreams: {p.workstreams.join(', ')}
                  </p>
                )}
                {p.bottleneck?.trim() && (
                  <p className="mt-2 text-xs text-amber-200/80">
                    Bottleneck: {p.bottleneck}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 4. Profile — how to phrase & rituals */}
      <div className="panel-card border-white/[0.06] p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          How you work
        </h3>
        <div className="mt-3 space-y-3 text-sm text-[var(--color-text-muted)]">
          {profile.roles.length > 0 && (
            <div>
              <span className="text-[var(--color-text-faint)]">Roles · </span>
              <span className="text-[var(--color-text-primary)]">{profile.roles.join(', ')}</span>
            </div>
          )}
          {profile.preferredTaskStyle.trim() && (
            <div>
              <span className="text-[var(--color-text-faint)]">Task style · </span>
              {profile.preferredTaskStyle}
            </div>
          )}
          {profile.preferredWarmup.trim() && (
            <div>
              <span className="text-[var(--color-text-faint)]">Warm-up · </span>
              {profile.preferredWarmup}
            </div>
          )}
          {profile.commonBlockers.length > 0 && (
            <div>
              <span className="text-[var(--color-text-faint)]">Common blockers · </span>
              {profile.commonBlockers.join('; ')}
            </div>
          )}
          {!profile.roles.length &&
            !profile.preferredTaskStyle.trim() &&
            !profile.preferredWarmup.trim() &&
            !profile.commonBlockers.length && (
              <p className="text-[var(--color-text-faint)]">No style preferences yet.</p>
            )}
        </div>
      </div>
    </section>
  )
}

function WorkingList({
  label,
  items,
  tone,
}: {
  label: string
  items: string[]
  tone: 'emerald' | 'amber' | 'rose' | 'slate'
}) {
  const ring =
    tone === 'emerald'
      ? 'border-emerald-500/20 bg-emerald-500/[0.05]'
      : tone === 'amber'
        ? 'border-amber-500/20 bg-amber-500/[0.05]'
        : tone === 'rose'
          ? 'border-rose-500/20 bg-rose-500/[0.05]'
          : 'border-white/[0.08] bg-white/[0.03]'

  return (
    <div className={`rounded-xl border px-3 py-3 ${ring}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
        {label}
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--color-text-faint)]">{LIST_EMPTY}</p>
      ) : (
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--color-text-primary)]">
          {items.map((line, i) => (
            <li key={i} className="marker:text-[var(--color-text-faint)]">
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
