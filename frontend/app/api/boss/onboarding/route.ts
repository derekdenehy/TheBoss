import { NextResponse } from 'next/server'
import {
  mergeAIContextPatch,
  onboardingSatisfied,
} from '@/lib/aiContextMerge'
import { callBossJsonModel } from '@/lib/boss-ai/callJsonModel'
import { resolveBossAiProvider } from '@/lib/boss-ai/config'
import type { ChatTurn } from '@/lib/boss-ai/callModel'
import type { AIContext } from '@/lib/types'

export const runtime = 'nodejs'

type OnboardingBody = {
  bootstrap?: boolean
  step?: string
  messages?: unknown
  draft?: unknown
  workspaceRoleNames?: unknown
}

type ModelOut = {
  message?: string
  patch?: Record<string, unknown> | null
  nextStep?: string
  finishOnboarding?: boolean
}

function isAIContext(x: unknown): x is AIContext {
  if (!x || typeof x !== 'object') return false
  const o = x as AIContext
  return (
    o.profile &&
    typeof o.profile === 'object' &&
    o.goals &&
    typeof o.goals === 'object' &&
    Array.isArray(o.projects) &&
    o.workingState &&
    typeof o.workingState === 'object'
  )
}

function isChatTurns(x: unknown): x is ChatTurn[] {
  if (!Array.isArray(x)) return false
  return x.every(
    (m) =>
      m &&
      typeof m === 'object' &&
      ((m as ChatTurn).role === 'user' || (m as ChatTurn).role === 'assistant') &&
      typeof (m as ChatTurn).content === 'string'
  )
}

const SYSTEM = `You are Boss, onboarding a new user through a short conversation. You reduce decision fatigue by asking ONE sharp question at a time.

OUTPUT: Return ONLY a JSON object (no markdown) with this shape:
{
  "message": "What the user reads — warm, concise, one question when appropriate.",
  "patch": null OR a partial object that updates their saved context. Allowed keys: "profile" (roles[], preferredTaskStyle, preferredWarmup, commonBlockers), "goals" (mainGoal, currentPriority, secondaryPriority), "projects" (array of {name, summary?, phase?, workstreams?, bottleneck?}), "workingState" (inProgress, urgent, blocked, avoiding as string arrays).
  "nextStep": "roles" | "goals" | "project" | "done",
  "finishOnboarding": boolean
}

RULES:
- Phase "roles" FIRST: Help them define 2–4 distinct "hats" or modes they switch between (e.g. student, founder, engineer, parent). Do NOT open with vague "what are you working on". Ask something specific like what contexts they mentally switch between in a typical week.
- Phase "goals": Elicit the single main outcome that matters in roughly the next few weeks.
- Phase "project": One concrete anchor — e.g. a problem set due today, a product, a client. Capture name (required); summary/phase optional.
- Do NOT require or prioritize preferredTaskStyle, warmups, or commonBlockers during onboarding — omit them from patch unless the user volunteers (they are learned over time later).
- When "patch" includes profile.roles, use short labels (2–6 words each), 2–4 roles.
- Set finishOnboarding true only when the draft would have: at least 2 roles, a non-empty mainGoal, and at least one project with a name. Otherwise finishOnboarding false.
- nextStep "done" when onboarding is effectively complete and you're wrapping up with a short encouraging closing message in "message".`

export async function POST(req: Request) {
  const provider = resolveBossAiProvider()
  if (!provider) {
    return NextResponse.json(
      {
        error:
          'Configure ANTHROPIC_API_KEY or OPENAI_API_KEY in frontend/.env.local to run conversational onboarding.',
      },
      { status: 503 }
    )
  }

  let body: OnboardingBody
  try {
    body = (await req.json()) as OnboardingBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const stepRaw = typeof body.step === 'string' ? body.step : 'roles'
  const step =
    stepRaw === 'goals' || stepRaw === 'project' || stepRaw === 'done' || stepRaw === 'roles'
      ? stepRaw
      : 'roles'

  if (!isAIContext(body.draft)) {
    return NextResponse.json({ error: 'Invalid draft aiContext' }, { status: 400 })
  }
  const draft = body.draft

  const workspaceRoleNames = Array.isArray(body.workspaceRoleNames)
    ? body.workspaceRoleNames.filter((x): x is string => typeof x === 'string')
    : []

  const bootstrap = body.bootstrap === true
  if (!bootstrap && !isChatTurns(body.messages)) {
    return NextResponse.json({ error: 'Expected messages[] or bootstrap: true' }, { status: 400 })
  }
  const messages = bootstrap ? [] : (body.messages as ChatTurn[])

  if (!bootstrap && messages.length === 0) {
    return NextResponse.json({ error: 'Empty messages' }, { status: 400 })
  }

  const convo =
    messages.length === 0
      ? '(No messages yet — this is the opening turn.)'
      : messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')

  const userPayload = [
    `Current step hint: ${step}`,
    `Existing draft JSON: ${JSON.stringify(draft)}`,
    `Workspace roles already created in the app (names): ${workspaceRoleNames.length ? workspaceRoleNames.join(', ') : 'none'}`,
    bootstrap ? 'MODE: BOOTSTRAP — produce only the first question JSON. patch should be null. nextStep roles. finishOnboarding false.' : '',
    `Conversation:\n${convo}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  try {
    const parsed = await callBossJsonModel<ModelOut>(provider, SYSTEM, userPayload)
    const message =
      typeof parsed.message === 'string' && parsed.message.trim()
        ? parsed.message.trim()
        : 'Tell me about the different hats you wear in a typical week — not job titles necessarily, but modes you switch into.'

    const patch =
      parsed.patch && typeof parsed.patch === 'object' ? parsed.patch : null
    const merged = mergeAIContextPatch(draft, patch)

    const satisfied = onboardingSatisfied(merged)
    let nextStep = typeof parsed.nextStep === 'string' ? parsed.nextStep : step
    if (!['roles', 'goals', 'project', 'done'].includes(nextStep)) {
      nextStep = step
    }

    if (!satisfied) {
      if (merged.profile.roles.filter(Boolean).length < 2) nextStep = 'roles'
      else if (!merged.goals.mainGoal.trim()) nextStep = 'goals'
      else if (!merged.projects.some((p) => p.name.trim())) nextStep = 'project'
    } else {
      nextStep = 'done'
    }

    const finishOnboarding =
      satisfied && (parsed.finishOnboarding === true || nextStep === 'done')

    return NextResponse.json({
      message,
      mergedContext: merged,
      nextStep,
      finishOnboarding,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
