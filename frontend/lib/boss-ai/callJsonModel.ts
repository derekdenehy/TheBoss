import type { BossAiProvider } from './config'
import { anthropicModel, openaiModel } from './config'

function extractJsonObject(text: string): string {
  const t = text.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t)
  if (fence) return fence[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) return t.slice(start, end + 1)
  return t
}

export async function callBossJsonModel<T>(
  provider: BossAiProvider,
  system: string,
  userContent: string
): Promise<T> {
  if (provider === 'openai') {
    return callOpenAiJson<T>(system, userContent)
  }
  const text = await callAnthropicText(system, userContent)
  return parseJson<T>(text)
}

async function callOpenAiJson<T>(system: string, userContent: string): Promise<T> {
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
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }),
  })

  const raw = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
    error?: { message?: string }
  }

  if (!res.ok) {
    throw new Error(raw.error?.message ?? res.statusText)
  }

  const text = raw.choices?.[0]?.message?.content
  if (!text) throw new Error('OpenAI returned no content')
  return parseJson<T>(text)
}

async function callAnthropicText(system: string, userContent: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim()
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set')

  const body = JSON.stringify({
    model: anthropicModel(),
    max_tokens: 2048,
    system: `${system}\n\nYou must respond with a single valid JSON object only. No markdown, no prose outside JSON.`,
    messages: [{ role: 'user', content: userContent }],
  })

  const attempt = () =>
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body,
    })

  // Retry up to 5 times on 529 (overloaded) with exponential backoff
  let res = await attempt()
  for (let i = 1; i <= 5 && res.status === 529; i++) {
    await new Promise((r) => setTimeout(r, i * 2000))
    res = await attempt()
  }

  const raw = (await res.json()) as {
    content?: { type: string; text?: string }[]
    error?: { message?: string; type?: string }
  }

  if (!res.ok) {
    console.error('[boss-ai] Anthropic error', res.status, JSON.stringify(raw.error))
    throw new Error(raw.error?.message ?? res.statusText)
  }

  const text = raw.content?.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('Anthropic returned no text')
  return text
}

function parseJson<T>(text: string): T {
  const raw = extractJsonObject(text)
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error(`Invalid JSON from model: ${raw.slice(0, 200)}`)
  }
}
