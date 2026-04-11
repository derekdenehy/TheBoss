import { NextResponse } from 'next/server'
import { mergeAIContextPatch } from '@/lib/aiContextMerge'
import { callBossJsonModel } from '@/lib/boss-ai/callJsonModel'
import { resolveBossAiProvider } from '@/lib/boss-ai/config'
import type { ChatTurn } from '@/lib/boss-ai/callModel'
import type { AIContext } from '@/lib/types'

export const runtime = 'nodejs'

// In-memory rate limiter — best-effort, resets on server restart.
// For multi-instance production deployments, replace with a Redis-based limiter.
const ipRequests = new Map<string, { count: number; resetAt: number }>()
const RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_MAX = 25 // generous enough for legit retries, not enough for abuse

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  // Prune stale entries to keep memory bounded
  if (ipRequests.size > 10_000) {
    for (const [key, val] of ipRequests) {
      if (now > val.resetAt) ipRequests.delete(key)
    }
  }
  const entry = ipRequests.get(ip)
  if (!entry || now > entry.resetAt) {
    ipRequests.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  if (entry.count >= RATE_MAX) return true
  entry.count++
  return false
}

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

type Step = 'dump' | 'roles' | 'done'

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

const SYSTEM = `You are Boss. You are onboarding a new user. Your one goal: make them feel like everything is under control within three short exchanges.

This user likely has ADHD or executive function challenges. They are already carrying too much. Do not add to their load. Every message you send should make them feel lighter, not questioned.

FLOW — three phases:

Phase "dump" (bootstrap only):
Send only the dump invitation. No preamble. No "before we set anything up." Start directly with the ask.
Example: "Dump everything you're managing right now. Don't organize it. Don't prioritize it. Just get it out."
patch: null. nextStep: "roles". finishOnboarding: false.

Phase "roles" (after the user's dump):
This is the dopamine turn. The user just unloaded — now show them their world being organized.
1. One short sentence naming the most urgent or emotionally loaded thing from their dump. Just name it, don't editorialize.
2. Surface the roles you inferred from their dump as a short confirmation — not a question about roles, a statement with a light check: "I've set you up as [Role A], [Role B], and [Role C]. Anything off?"
Keep this tight. Two sentences max before the question. No lists.
Extract everything you can from the dump into the patch — roles, urgent items, projects, goals.
nextStep: "done". finishOnboarding: false.

Phase "done" (after role confirmation):
Close fast. One short paragraph. Name the one thing to start with today. Make it feel like the path is clear.
Do not ask any more questions. Just close.
Apply any role corrections the user gave. Set finishOnboarding: true.

STRICT RULES:
- No bullet points. No numbered lists. Short paragraphs only.
- One question per message, maximum. The only question across the whole flow is the role confirmation in phase "roles".
- Never open any message with "Great!", "Sure!", "Absolutely!", "Of course!", "I can see that..."
- No productivity jargon. No time-boxing, prioritizing, north star, MoSCoW, sprints.
- Do not reflect the full dump back to the user. Pick one thing.
- Warm but not performative. Direct. Short sentences.

PATCH EXTRACTION — from the dump and role confirmation, silently populate:
- profile.roles: infer what contexts the user switches between (2–4 short labels, e.g. "Student", "Startup Founder", "Side Project")
- workingState.urgent: items with deadlines or emotional weight
- workingState.inProgress: things actively being worked on
- projects: any named project or major effort mentioned
- goals.mainGoal: what seems to matter most overall
Sparse context is fine. Do not invent details not present in the dump.

OUTPUT: Return ONLY a valid JSON object, no markdown:
{
  "message": "string",
  "patch": null | { partial AIContext fields },
  "nextStep": "dump" | "roles" | "done",
  "finishOnboarding": boolean
}`

export async function POST(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in an hour.' },
      { status: 429 }
    )
  }

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

  const stepRaw = typeof body.step === 'string' ? body.step : 'dump'
  const step: Step =
    stepRaw === 'roles' || stepRaw === 'done' ? stepRaw : 'dump'

  if (!isAIContext(body.draft)) {
    return NextResponse.json({ error: 'Invalid draft aiContext' }, { status: 400 })
  }
  const draft = body.draft

  const bootstrap = body.bootstrap === true
  if (!bootstrap && !isChatTurns(body.messages)) {
    return NextResponse.json({ error: 'Expected messages[] or bootstrap: true' }, { status: 400 })
  }
  const messages = bootstrap ? [] : (body.messages as ChatTurn[])

  if (!bootstrap && messages.length === 0) {
    return NextResponse.json({ error: 'Empty messages' }, { status: 400 })
  }

  const userCount = messages.filter((m) => m.role === 'user').length

  const convo =
    messages.length === 0
      ? '(No messages yet — this is the opening turn.)'
      : messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')

  const userPayload = [
    `Current phase: ${step}`,
    `Existing draft context: ${JSON.stringify(draft)}`,
    bootstrap ? 'MODE: BOOTSTRAP — send only the brain dump invitation. patch: null. nextStep: "warmup". finishOnboarding: false.' : '',
    `Conversation:\n${convo}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  try {
    const parsed = await callBossJsonModel<ModelOut>(provider, SYSTEM, userPayload)

    const message =
      typeof parsed.message === 'string' && parsed.message.trim()
        ? parsed.message.trim()
        : 'Dump everything you\'re managing right now. Don\'t organize it. Don\'t prioritize it. Just get it out.'

    const patch =
      parsed.patch && typeof parsed.patch === 'object' ? parsed.patch : null
    const merged = mergeAIContextPatch(draft, patch)

    let nextStep: Step =
      parsed.nextStep === 'roles' || parsed.nextStep === 'done' ? parsed.nextStep : step

    // Only allow finishing after the user has sent at least 2 messages (dump + warmup answer)
    const finishOnboarding = userCount >= 2 && parsed.finishOnboarding === true

    if (finishOnboarding) nextStep = 'done'

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
