import type { BossAiProvider } from './config'
import { anthropicModel, openaiModel } from './config'

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

export async function callBossChatModel(
  provider: BossAiProvider,
  system: string,
  messages: ChatTurn[]
): Promise<string> {
  if (provider === 'anthropic') {
    return callAnthropic(system, messages)
  }
  return callOpenAI(system, messages)
}

async function callAnthropic(system: string, messages: ChatTurn[]): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim()
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: anthropicModel(),
      max_tokens: 2048,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  })

  const raw = (await res.json()) as {
    content?: { type: string; text?: string }[]
    error?: { message?: string }
  }

  if (!res.ok) {
    const msg = raw.error?.message ?? res.statusText
    throw new Error(`Anthropic: ${msg}`)
  }

  const text = raw.content?.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('Anthropic returned no text')
  return text
}

async function callOpenAI(system: string, messages: ChatTurn[]): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) throw new Error('OPENAI_API_KEY is not set')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: openaiModel(),
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  })

  const raw = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
    error?: { message?: string }
  }

  if (!res.ok) {
    const msg = raw.error?.message ?? res.statusText
    throw new Error(`OpenAI: ${msg}`)
  }

  const text = raw.choices?.[0]?.message?.content
  if (!text) throw new Error('OpenAI returned no text')
  return text
}
