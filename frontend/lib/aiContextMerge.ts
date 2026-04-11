import type { AIContext, ProjectContext, UserGoals, UserProfile, WorkingState } from './types'

function normalizeProjects(raw: unknown): ProjectContext[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: ProjectContext[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name.trim() : ''
    if (!name) continue
    const bottleneck = o.bottleneck
    out.push({
      name,
      summary: typeof o.summary === 'string' ? o.summary.trim() : '',
      phase: typeof o.phase === 'string' ? o.phase.trim() : '',
      workstreams: Array.isArray(o.workstreams)
        ? o.workstreams.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean)
        : [],
      ...(typeof bottleneck === 'string' && bottleneck.trim() ? { bottleneck: bottleneck.trim() } : {}),
    })
  }
  return out.length ? out : undefined
}

/** Deep-merge a model-provided patch into the current AI context (onboarding + chat patches). */
export function mergeAIContextPatch(
  base: AIContext,
  patch: Record<string, unknown> | null | undefined
): AIContext {
  if (!patch || typeof patch !== 'object') return base

  const next: AIContext = JSON.parse(JSON.stringify(base)) as AIContext

  if (patch.profile && typeof patch.profile === 'object') {
    const pr = patch.profile as Partial<UserProfile> & Record<string, unknown>
    if (Array.isArray(pr.roles)) {
      next.profile.roles = pr.roles
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim())
        .filter(Boolean)
    }
    if (typeof pr.preferredTaskStyle === 'string') {
      next.profile.preferredTaskStyle = pr.preferredTaskStyle.trim()
    }
    if (typeof pr.preferredWarmup === 'string') {
      next.profile.preferredWarmup = pr.preferredWarmup.trim()
    }
    if (Array.isArray(pr.commonBlockers)) {
      next.profile.commonBlockers = pr.commonBlockers
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim())
        .filter(Boolean)
    }
  }

  if (patch.goals && typeof patch.goals === 'object') {
    const g = patch.goals as Partial<UserGoals>
    if (typeof g.mainGoal === 'string') next.goals.mainGoal = g.mainGoal.trim()
    if (typeof g.currentPriority === 'string') next.goals.currentPriority = g.currentPriority.trim()
    if (typeof g.secondaryPriority === 'string') {
      const s = g.secondaryPriority.trim()
      if (s) next.goals.secondaryPriority = s
      else delete next.goals.secondaryPriority
    }
  }

  const projects = normalizeProjects(patch.projects)
  if (projects) {
    next.projects = projects
  }

  if (patch.workingState && typeof patch.workingState === 'object') {
    const w = patch.workingState as Partial<WorkingState>
    const mergeList = (key: keyof WorkingState, val: unknown) => {
      if (!Array.isArray(val)) return
      next.workingState[key] = val
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim())
        .filter(Boolean)
    }
    mergeList('inProgress', w.inProgress)
    mergeList('urgent', w.urgent)
    mergeList('blocked', w.blocked)
    mergeList('avoiding', w.avoiding)
  }

  return next
}

export function onboardingSatisfied(ctx: AIContext): boolean {
  return (
    ctx.profile.roles.filter(Boolean).length >= 2 &&
    ctx.goals.mainGoal.trim().length > 0 &&
    ctx.projects.some((p) => p.name.trim().length > 0)
  )
}
