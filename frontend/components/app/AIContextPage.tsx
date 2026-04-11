'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppState } from '@/context/AppStateContext'
import { emptyAIContext } from '@/lib/types'
import type { AIContext, ProjectContext } from '@/lib/types'

function splitLinesOrCommas(s: string): string[] {
  const parts = s
    .split(/[\n,]+/)
    .map((x) => x.trim())
    .filter(Boolean)
  const out: string[] = []
  for (const p of parts) {
    if (!out.includes(p)) out.push(p)
  }
  return out
}

function linesToText(lines: string[]): string {
  return lines.join('\n')
}

function cloneCtx(c: AIContext): AIContext {
  return JSON.parse(JSON.stringify(c)) as AIContext
}

export function AIContextPage() {
  const router = useRouter()
  const {
    hydrated,
    aiContext,
    aiContextSetupComplete,
    setAIContext,
    setAIContextSetupComplete,
  } = useAppState()

  const [onboardRoles, setOnboardRoles] = useState('')
  const [onboardProject, setOnboardProject] = useState('')
  const [onboardProjectSummary, setOnboardProjectSummary] = useState('')
  const [onboardProjectPhase, setOnboardProjectPhase] = useState('')
  const [onboardGoal, setOnboardGoal] = useState('')
  const [onboardTaskStyle, setOnboardTaskStyle] = useState('')
  const [onboardWarmup, setOnboardWarmup] = useState('')
  const [onboardBlocker, setOnboardBlocker] = useState('')

  const [draft, setDraft] = useState<AIContext>(() => cloneCtx(emptyAIContext()))
  const [savedFlash, setSavedFlash] = useState(false)
  const showOnboarding = hydrated && !aiContextSetupComplete
  const aiContextRef = useRef(aiContext)
  aiContextRef.current = aiContext

  useEffect(() => {
    if (!hydrated || showOnboarding) return
    setDraft(cloneCtx(aiContextRef.current))
    // Intentionally omit aiContext: avoid resetting the form when tasks update workingState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, showOnboarding])

  const submitOnboarding = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const roles = splitLinesOrCommas(onboardRoles)
      const project = onboardProject.trim()
      const mainGoal = onboardGoal.trim()
      if (!project || !mainGoal) return

      const blockers = onboardBlocker.trim() ? [onboardBlocker.trim()] : []

      const next: AIContext = {
        ...emptyAIContext(),
        profile: {
          roles,
          preferredTaskStyle: onboardTaskStyle.trim(),
          preferredWarmup: onboardWarmup.trim(),
          commonBlockers: blockers,
        },
        goals: {
          mainGoal,
          currentPriority: project,
        },
        projects: project
          ? [
              {
                name: project,
                summary: onboardProjectSummary.trim(),
                phase: onboardProjectPhase.trim(),
                workstreams: [],
              },
            ]
          : [],
        workingState: emptyAIContext().workingState,
      }
      setAIContext(next)
      setAIContextSetupComplete(true)
      router.push('/boss')
    },
    [
      onboardRoles,
      onboardProject,
      onboardProjectSummary,
      onboardProjectPhase,
      onboardGoal,
      onboardTaskStyle,
      onboardWarmup,
      onboardBlocker,
      setAIContext,
      setAIContextSetupComplete,
      router,
    ]
  )

  const finishSkipOnboarding = useCallback(() => {
    setAIContextSetupComplete(true)
    router.push('/boss')
  }, [router, setAIContextSetupComplete])

  const saveStudio = useCallback(() => {
    setAIContext(cloneCtx(draft))
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 2000)
  }, [draft, setAIContext])

  const updateProject = useCallback((index: number, patch: Partial<ProjectContext>) => {
    setDraft((d) => {
      const projects = [...d.projects]
      const cur = projects[index]
      if (!cur) return d
      projects[index] = { ...cur, ...patch }
      return { ...d, projects }
    })
  }, [])

  const addProject = useCallback(() => {
    setDraft((d) => ({
      ...d,
      projects: [
        ...d.projects,
        { name: 'New project', summary: '', phase: '', workstreams: [] },
      ],
    }))
  }, [])

  const removeProject = useCallback((index: number) => {
    setDraft((d) => ({
      ...d,
      projects: d.projects.filter((_, i) => i !== index),
    }))
  }, [])

  const fieldClass =
    'w-full rounded-xl border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40'
  const labelClass = 'block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]'

  const onboardingValid = useMemo(() => {
    return onboardProject.trim().length > 0 && onboardGoal.trim().length > 0
  }, [onboardProject, onboardGoal])

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--color-text-muted)]">
        Loading…
      </div>
    )
  }

  if (showOnboarding) {
    return (
      <div className="mx-auto max-w-lg pb-20">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/80">
            Step 1 · Build your context
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">
            Before Focus &amp; Chat, tell Boss what matters
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            This creates your saved context: <strong className="font-medium text-[var(--color-text-primary)]">profile</strong>,{' '}
            <strong className="font-medium text-[var(--color-text-primary)]">goals</strong>, and a first{' '}
            <strong className="font-medium text-[var(--color-text-primary)]">project</strong>.{' '}
            <strong className="font-medium text-[var(--color-text-primary)]">Working state</strong> fills in as
            you move tasks. Everything lives in one place (AI Studio) — not scattered files.
          </p>
          <ol className="mt-4 space-y-1.5 rounded-xl border border-white/[0.06] bg-[var(--color-bg-panel)]/40 px-4 py-3 text-xs text-[var(--color-text-muted)]">
            <li>
              <span className="font-medium text-sky-300/90">1.</span> Profile — roles, task style, warm-up,
              blockers
            </li>
            <li>
              <span className="font-medium text-sky-300/90">2.</span> Goals — main aim + what you&apos;re
              pushing on now
            </li>
            <li>
              <span className="font-medium text-sky-300/90">3.</span> Project — name + optional summary &
              phase
            </li>
          </ol>
        </header>

        <form onSubmit={submitOnboarding} className="space-y-5">
          <div>
            <label className={labelClass}>What roles do you usually switch between?</label>
            <p className="mt-1 text-[11px] text-[var(--color-text-faint)]">
              Separate with commas or new lines (e.g. CEO, Engineer).
            </p>
            <textarea
              className={`${fieldClass} mt-2 min-h-[72px] resize-y`}
              value={onboardRoles}
              onChange={(e) => setOnboardRoles(e.target.value)}
              placeholder="CEO, Engineer, Marketing"
              rows={3}
            />
          </div>

          <div>
            <label className={labelClass}>What project are you mainly trying to move right now?</label>
            <input
              className={`${fieldClass} mt-2`}
              value={onboardProject}
              onChange={(e) => setOnboardProject(e.target.value)}
              placeholder="e.g. Pumped"
              required
            />
          </div>

          <div>
            <label className={labelClass}>Project in one sentence (optional)</label>
            <input
              className={`${fieldClass} mt-2`}
              value={onboardProjectSummary}
              onChange={(e) => setOnboardProjectSummary(e.target.value)}
              placeholder="e.g. Gym-focused social app for finding workout partners"
            />
          </div>

          <div>
            <label className={labelClass}>What phase is it in? (optional)</label>
            <input
              className={`${fieldClass} mt-2`}
              value={onboardProjectPhase}
              onChange={(e) => setOnboardProjectPhase(e.target.value)}
              placeholder="e.g. growth validation, MVP build, idea stage"
            />
          </div>

          <div>
            <label className={labelClass}>What is your main goal at the moment?</label>
            <input
              className={`${fieldClass} mt-2`}
              value={onboardGoal}
              onChange={(e) => setOnboardGoal(e.target.value)}
              placeholder="e.g. Grow distribution"
              required
            />
          </div>

          <div>
            <label className={labelClass}>How should tasks be phrased for you?</label>
            <input
              className={`${fieldClass} mt-2`}
              value={onboardTaskStyle}
              onChange={(e) => setOnboardTaskStyle(e.target.value)}
              placeholder="e.g. Small concrete next actions"
            />
          </div>

          <div>
            <label className={labelClass}>What warm-up helps you enter work?</label>
            <input
              className={`${fieldClass} mt-2`}
              value={onboardWarmup}
              onChange={(e) => setOnboardWarmup(e.target.value)}
              placeholder="e.g. Quick email triage"
            />
          </div>

          <div>
            <label className={labelClass}>What usually gets you stuck?</label>
            <input
              className={`${fieldClass} mt-2`}
              value={onboardBlocker}
              onChange={(e) => setOnboardBlocker(e.target.value)}
              placeholder="e.g. Overthinking priorities"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4">
            <button
              type="submit"
              disabled={!onboardingValid}
              className="rounded-xl bg-sky-500/90 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save context &amp; enter Boss
            </button>
            <button
              type="button"
              className="text-xs text-[var(--color-text-faint)] underline-offset-4 hover:text-[var(--color-text-muted)] hover:underline"
              onClick={finishSkipOnboarding}
            >
              Skip for now (empty context)
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/boss"
            className="text-xs text-[var(--color-text-faint)] transition hover:text-sky-300/90"
          >
            ← Boss
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-[var(--color-text-primary)]">AI Studio</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Context for future Boss assistance — not a raw JSON editor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedFlash && (
            <span className="text-xs font-medium text-emerald-300/90" role="status">
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={saveStudio}
            className="rounded-xl bg-sky-500/90 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
          >
            Save changes
          </button>
        </div>
      </header>

      <p className="mb-8 rounded-xl border border-white/[0.06] bg-[var(--color-bg-panel)]/50 px-4 py-3 text-xs text-[var(--color-text-muted)]">
        <strong className="text-[var(--color-text-primary)]">Working state</strong> (in progress,
        urgent, blocked, avoiding) also updates when you move tasks — and when you mark tasks done.
      </p>

      <section className="panel-card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Profile</h2>
        <div>
          <label className={labelClass}>Active roles</label>
          <textarea
            className={`${fieldClass} mt-2 min-h-[72px]`}
            value={linesToText(draft.profile.roles)}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                profile: { ...d.profile, roles: splitLinesOrCommas(e.target.value) },
              }))
            }
            rows={3}
          />
        </div>
        <div>
          <label className={labelClass}>Preferred task style</label>
          <input
            className={`${fieldClass} mt-2`}
            value={draft.profile.preferredTaskStyle}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                profile: { ...d.profile, preferredTaskStyle: e.target.value },
              }))
            }
          />
        </div>
        <div>
          <label className={labelClass}>Preferred warm-up</label>
          <input
            className={`${fieldClass} mt-2`}
            value={draft.profile.preferredWarmup}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                profile: { ...d.profile, preferredWarmup: e.target.value },
              }))
            }
          />
        </div>
        <div>
          <label className={labelClass}>Common blockers</label>
          <p className="mt-1 text-[11px] text-[var(--color-text-faint)]">One per line.</p>
          <textarea
            className={`${fieldClass} mt-2 min-h-[80px]`}
            value={linesToText(draft.profile.commonBlockers)}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                profile: {
                  ...d.profile,
                  commonBlockers: e.target.value
                    .split('\n')
                    .map((x) => x.trim())
                    .filter(Boolean),
                },
              }))
            }
            rows={4}
          />
        </div>
      </section>

      <section className="panel-card mt-6 space-y-4 p-5">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Goals</h2>
        <div>
          <label className={labelClass}>Main goal</label>
          <input
            className={`${fieldClass} mt-2`}
            value={draft.goals.mainGoal}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                goals: { ...d.goals, mainGoal: e.target.value },
              }))
            }
          />
        </div>
        <div>
          <label className={labelClass}>Current priority</label>
          <input
            className={`${fieldClass} mt-2`}
            value={draft.goals.currentPriority}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                goals: { ...d.goals, currentPriority: e.target.value },
              }))
            }
          />
        </div>
        <div>
          <label className={labelClass}>Secondary priority (optional)</label>
          <input
            className={`${fieldClass} mt-2`}
            value={draft.goals.secondaryPriority ?? ''}
            onChange={(e) => {
              const v = e.target.value.trim()
              setDraft((d) => ({
                ...d,
                goals: {
                  ...d.goals,
                  ...(v ? { secondaryPriority: v } : { secondaryPriority: undefined }),
                },
              }))
            }}
          />
        </div>
      </section>

      <section className="panel-card mt-6 space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Projects</h2>
          <button
            type="button"
            onClick={addProject}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-sky-200/90 hover:bg-white/[0.04]"
          >
            + Add project
          </button>
        </div>
        {draft.projects.length === 0 ? (
          <p className="text-sm text-[var(--color-text-faint)]">No projects yet.</p>
        ) : (
          <ul className="space-y-6">
            {draft.projects.map((p, i) => (
              <li
                key={i}
                className="rounded-xl border border-white/[0.06] bg-[var(--color-bg-deep)]/40 p-4"
              >
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeProject(i)}
                    className="text-xs text-rose-300/80 hover:underline"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Name</label>
                    <input
                      className={`${fieldClass} mt-1`}
                      value={p.name}
                      onChange={(e) => updateProject(i, { name: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Summary</label>
                    <input
                      className={`${fieldClass} mt-1`}
                      value={p.summary}
                      onChange={(e) => updateProject(i, { summary: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Phase</label>
                    <input
                      className={`${fieldClass} mt-1`}
                      value={p.phase}
                      onChange={(e) => updateProject(i, { phase: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Bottleneck (optional)</label>
                    <input
                      className={`${fieldClass} mt-1`}
                      value={p.bottleneck ?? ''}
                      onChange={(e) => {
                        const v = e.target.value.trim()
                        updateProject(i, v ? { bottleneck: v } : { bottleneck: undefined })
                      }}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Workstreams</label>
                    <p className="mt-1 text-[11px] text-[var(--color-text-faint)]">
                      Comma-separated (e.g. engineering, outreach).
                    </p>
                    <input
                      className={`${fieldClass} mt-1`}
                      value={p.workstreams.join(', ')}
                      onChange={(e) =>
                        updateProject(i, {
                          workstreams: splitLinesOrCommas(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel-card mt-6 space-y-4 p-5">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Working state</h2>
        <p className="text-xs text-[var(--color-text-muted)]">
          One item per line. Also synced from task statuses (in progress / done) as you work.
        </p>
        {(
          [
            ['inProgress', 'In progress'],
            ['urgent', 'Urgent'],
            ['blocked', 'Blocked'],
            ['avoiding', 'Avoiding'],
          ] as const
        ).map(([key, title]) => (
          <div key={key}>
            <label className={labelClass}>{title}</label>
            <textarea
              className={`${fieldClass} mt-2 min-h-[72px] font-mono text-xs`}
              value={linesToText(draft.workingState[key])}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  workingState: {
                    ...d.workingState,
                    [key]: e.target.value
                      .split('\n')
                      .map((x) => x.trim())
                      .filter(Boolean),
                  },
                }))
              }
              rows={4}
            />
          </div>
        ))}
      </section>

      <div className="mt-8 text-center">
        <button
          type="button"
          className="text-xs text-[var(--color-text-faint)] hover:text-amber-200/80 hover:underline"
          onClick={() => {
            setAIContextSetupComplete(false)
          }}
        >
          Run quick setup again
        </button>
      </div>
    </div>
  )
}
