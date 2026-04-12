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

type Step = 'dump' | 'clarify' | 'roles' | 'confirm' | 'rates' | 'done'

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

const SYSTEM = `You are Boss. You are onboarding a new user. Your one goal: make them feel like everything is under control within a few short exchanges.

This user likely has ADHD or executive function challenges. Every message you send should give them something back. Never just extract more from them.

ROLES PHILOSOPHY — this is critical:
Roles represent modes of work, not projects or job titles. The same project can have multiple roles if the work requires different modes. A founder who codes AND does outreach is in two different cognitive modes — those should be separate roles with separate rates. Ask yourself: when this person sits down to do X, does it feel mentally different from Y? If yes, they are separate roles.

ROLE NAMING — equally critical:
Name each role after the job title of the professional who would be hired to do that work full-time. The user is "wearing the hat" of that professional when clocked in. This makes the role feel like a real identity, not a project label.
Good names: "Software Engineer", "Growth Marketer", "Product Manager", "Student", "Content Creator", "Sales Rep", "Graphic Designer"
Bad names: "Startup Growth", "Builder", "Founder", "Marketing", "Tech Work" — too vague or project-scoped
The prefix "Startup" or project name should almost never appear in a role name. The role is the mode of work, not the project it serves.

FLOW — five phases:

Phase "dump" (bootstrap only):
Send only the dump invitation. No preamble. Start directly.
Example: "Dump everything you're managing right now. Don't organize it. Don't prioritize it. Just get it out."
patch: null. nextStep: "clarify". finishOnboarding: false.

Phase "clarify" (after the user's dump):
You need one more piece of information before you can create accurate roles.
1. One sentence naming the most urgent or emotionally loaded thing from their dump.
2. Ask ONE smart question about the most ambiguous entry — specifically what KINDS of work are happening inside it. The goal is to find out if a single project has multiple modes (e.g. technical vs business, building vs selling, writing vs designing).
Focus on the entry most likely to split into multiple roles. Examples:
- "For the gym app — are you writing the code, running the outreach and business side, or doing both?"
- "On the startup — is it mainly engineering work, or are you also doing the marketing and sales?"
- "For the freelance work — is it one type of project or do you switch between different kinds of tasks?"
Do not list roles yet. Do not summarize the dump. Just name urgency + one clarifying question.
patch: extract what you can from the dump (urgent, inProgress, projects, mainGoal). nextStep: "roles". finishOnboarding: false.

Phase "roles" (after the clarification answer):
Now you have enough to create precise roles.
Infer 2–5 roles that reflect actual work modes — split projects where the work is genuinely different.
Your message must:
1. Explain the naming concept in one sentence.
2. List the inferred roles.
3. Ask if anything is missing or needs changing — one short question at the end.
4. Add a casual note that they can add more roles at any time from the sidebar later, so no pressure to get it perfect now.
Example: "Each role is named after the actual job — when you clock in, you're wearing that hat. Here are yours: Student, Software Engineer, Growth Marketer. Anything missing or need renaming? You can always add more from the sidebar later."
patch: set profile.roles with the inferred role labels. nextStep: "confirm". finishOnboarding: false.

Phase "confirm" (after the user responds to the role check):
The user either approved the roles or gave corrections/additions.
Process any changes — add missing roles, rename incorrect ones, remove any they reject.
Respond in one short sentence confirming what changed (or that everything looks good), then hand off to the rates UI.
Example with changes: "Added Graphic Designer and renamed Growth Marketer to Marketing Manager — you're all set."
Example with no changes: "Perfect, that's your lineup."
Do NOT ask another question. The UI takes over from here.
patch: update profile.roles with the final corrected list. nextStep: "rates". finishOnboarding: false.

Phase "rates" (user submits rates from the UI as a message like "Student: $15/hr, Software Engineer: $60/hr"):
The rates are already collected — just write the closing.
One short paragraph: name the one concrete thing to start with today, make the path feel clear. No questions.
patch: null. nextStep: "done". finishOnboarding: true.

STRICT RULES:
- No bullet points. No numbered lists. Short paragraphs only.
- One question per message, maximum. Only in the "clarify" phase.
- Never open any message with "Great!", "Sure!", "Absolutely!", "Of course!", "I can see that..."
- No productivity jargon. No time-boxing, prioritizing, north star, MoSCoW, sprints.
- Do not reflect the full dump back to the user. Pick one thing.
- Warm but not performative. Direct. Short sentences.

PATCH EXTRACTION:
- profile.roles: precise work-mode labels (not project names, not job titles)
- workingState.urgent: items with deadlines or emotional weight
- workingState.inProgress: things actively being worked on
- projects: any named project or major effort mentioned
- goals.mainGoal: what seems to matter most overall

OUTPUT: Return ONLY a valid JSON object, no markdown:
{
  "message": "string",
  "patch": null | { partial AIContext fields },
  "nextStep": "dump" | "clarify" | "roles" | "rates" | "done",
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
    stepRaw === 'clarify' ||
    stepRaw === 'roles' ||
    stepRaw === 'confirm' ||
    stepRaw === 'rates' ||
    stepRaw === 'done'
      ? stepRaw
      : 'dump'

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
    bootstrap ? 'MODE: BOOTSTRAP — send only the brain dump invitation. patch: null. nextStep: "clarify". finishOnboarding: false.' : '',
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
      parsed.nextStep === 'clarify' ||
      parsed.nextStep === 'roles' ||
      parsed.nextStep === 'confirm' ||
      parsed.nextStep === 'rates' ||
      parsed.nextStep === 'done'
        ? parsed.nextStep
        : step

    // Only allow finishing after the user has sent at least 4 messages (dump + clarify + confirm + rates)
    const finishOnboarding = userCount >= 4 && parsed.finishOnboarding === true

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
