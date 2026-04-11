import { NextResponse } from 'next/server'
import { callBossChatModel, type ChatTurn } from '@/lib/boss-ai/callModel'
import { getBossAiPublicConfig, resolveBossAiProvider } from '@/lib/boss-ai/config'
import { formatAIContextForPrompt } from '@/lib/aiContext'
import type { AIContext } from '@/lib/types'

export const runtime = 'nodejs'

/** Whether Boss chat can run (keys present). Which provider wins if both keys exist. */
export async function GET() {
  return NextResponse.json(getBossAiPublicConfig())
}

type Body = {
  messages?: unknown
  aiContext?: unknown
}

function isChatTurns(x: unknown): x is ChatTurn[] {
  if (!Array.isArray(x)) return false
  return x.every(
    (m) =>
      m &&
      typeof m === 'object' &&
      (m as ChatTurn).role !== undefined &&
      ((m as ChatTurn).role === 'user' || (m as ChatTurn).role === 'assistant') &&
      typeof (m as ChatTurn).content === 'string'
  )
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

export async function POST(req: Request) {
  const provider = resolveBossAiProvider()
  if (!provider) {
    return NextResponse.json(
      {
        error:
          'No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in frontend/.env.local (server-side, not NEXT_PUBLIC_). Optional: BOSS_AI_PROVIDER=anthropic|openai if both are set.',
      },
      { status: 503 }
    )
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!isChatTurns(body.messages) || body.messages.length === 0) {
    return NextResponse.json(
      { error: 'Expected non-empty messages: { role: "user"|"assistant", content: string }[]' },
      { status: 400 }
    )
  }

  const last = body.messages[body.messages.length - 1]
  if (last.role !== 'user') {
    return NextResponse.json({ error: 'Last message must be from the user' }, { status: 400 })
  }

  const contextBlock =
    body.aiContext && isAIContext(body.aiContext)
      ? formatAIContextForPrompt(body.aiContext)
      : 'No structured user context provided yet. Suggest filling AI Studio under /boss/context.'

  const system = `You are Boss, the orchestration layer for this user's workday. You only know what appears in the structured context below (and the chat). Do not invent goals, projects, or tasks that are not implied there.

How to think (in order — mirror this in answers when helpful):
1) Working state — what is in progress, urgent, blocked, or being avoided right now.
2) Goals — what matters most; align recommendations with main goal and current priority.
3) Projects — use names, phase, workstreams, bottlenecks when choosing where to spend attention.
4) Profile — phrase suggestions in their preferred task style; respect warm-up and common blockers (e.g. if they stall on vague tasks, force concrete verbs and small scopes).

Output style: default to ONE clear primary recommendation for what to do next, optionally up to two alternates. Use short bullets or tight paragraphs. Ask at most one clarifying question only if the context is empty or contradictory.

Structured context:
${contextBlock}`

  try {
    const reply = await callBossChatModel(provider, system, body.messages)
    return NextResponse.json({ reply, provider })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
