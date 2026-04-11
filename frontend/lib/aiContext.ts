import type { TaskStatus, WorkingState } from './types'

const LIST_CAP = 40

function withoutLine(list: string[], line: string): string[] {
  return list.filter((x) => x !== line)
}

function withoutLines(list: string[], lines: Set<string>): string[] {
  return list.filter((x) => !lines.has(x))
}

function addUniqueTail(list: string[], line: string): string[] {
  if (!line) return list
  const next = list.filter((x) => x !== line)
  next.push(line)
  return next.slice(-LIST_CAP)
}

/** Remove one line from every working-state bucket. */
export function removeLineFromAllWorkingState(ws: WorkingState, line: string): WorkingState {
  if (!line) return ws
  return {
    inProgress: withoutLine(ws.inProgress, line),
    urgent: withoutLine(ws.urgent, line),
    blocked: withoutLine(ws.blocked, line),
    avoiding: withoutLine(ws.avoiding, line),
  }
}

export function removeLinesFromAllWorkingState(ws: WorkingState, lines: string[]): WorkingState {
  const set = new Set(lines.map((s) => s.trim()).filter(Boolean))
  if (set.size === 0) return ws
  return {
    inProgress: withoutLines(ws.inProgress, set),
    urgent: withoutLines(ws.urgent, set),
    blocked: withoutLines(ws.blocked, set),
    avoiding: withoutLines(ws.avoiding, set),
  }
}

/**
 * Keep workingState.inProgress aligned with task titles when status/title changes.
 * Completing a task drops its title from all buckets.
 */
export function syncWorkingStateAfterTaskPatch(
  ws: WorkingState,
  before: { title: string; status: TaskStatus },
  after: { title: string; status: TaskStatus }
): WorkingState {
  const prevLine = before.title.trim()
  const nextLine = after.title.trim()
  let next = ws

  if (before.status === 'in_progress' && after.status === 'in_progress' && prevLine !== nextLine) {
    next = {
      ...next,
      inProgress: next.inProgress.map((x) => (x === prevLine ? nextLine : x)),
    }
  }

  if (before.status === 'in_progress' && after.status !== 'in_progress') {
    next = { ...next, inProgress: withoutLine(next.inProgress, prevLine) }
  }

  if (after.status === 'in_progress' && before.status !== 'in_progress' && nextLine) {
    next = { ...next, inProgress: addUniqueTail(next.inProgress, nextLine) }
  }

  if (after.status === 'done' && nextLine) {
    next = removeLineFromAllWorkingState(next, nextLine)
  }

  return next
}

/**
 * Ordered block for future Boss-tab prompts: now → strategy → projects → style.
 */
export function formatAIContextForPrompt(ctx: {
  workingState: WorkingState
  goals: { mainGoal: string; currentPriority: string; secondaryPriority?: string }
  projects: { name: string; summary: string; phase: string; workstreams: string[]; bottleneck?: string }[]
  profile: {
    roles: string[]
    preferredTaskStyle: string
    preferredWarmup: string
    commonBlockers: string[]
  }
}): string {
  const lines: string[] = ['## Working state (now)', '']

  const ws = ctx.workingState
  lines.push(
    `In progress: ${ws.inProgress.length ? ws.inProgress.join('; ') : '—'}`,
    `Urgent: ${ws.urgent.length ? ws.urgent.join('; ') : '—'}`,
    `Blocked: ${ws.blocked.length ? ws.blocked.join('; ') : '—'}`,
    `Avoiding: ${ws.avoiding.length ? ws.avoiding.join('; ') : '—'}`,
    '',
    '## Goals',
    '',
    `Main: ${ctx.goals.mainGoal || '—'}`,
    `Current priority: ${ctx.goals.currentPriority || '—'}`,
    ...(ctx.goals.secondaryPriority
      ? [`Secondary: ${ctx.goals.secondaryPriority}`]
      : []),
    '',
    '## Projects',
    ''
  )

  if (ctx.projects.length === 0) {
    lines.push('—', '')
  } else {
    for (const p of ctx.projects) {
      lines.push(
        `- ${p.name}${p.phase ? ` (${p.phase})` : ''}: ${p.summary || '—'}`,
        `  Workstreams: ${p.workstreams.length ? p.workstreams.join(', ') : '—'}`,
        ...(p.bottleneck ? [`  Bottleneck: ${p.bottleneck}`] : []),
        ''
      )
    }
  }

  lines.push(
    '## Profile',
    '',
    `Roles: ${ctx.profile.roles.length ? ctx.profile.roles.join(', ') : '—'}`,
    `Task style: ${ctx.profile.preferredTaskStyle || '—'}`,
    `Warm-up: ${ctx.profile.preferredWarmup || '—'}`,
    `Common blockers: ${ctx.profile.commonBlockers.length ? ctx.profile.commonBlockers.join('; ') : '—'}`
  )

  return lines.join('\n')
}
