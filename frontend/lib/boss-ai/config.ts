export type BossAiProvider = 'anthropic' | 'openai'

export type BossAiPublicConfig = {
  configured: boolean
  provider: BossAiProvider | null
}

/** Server-only: which provider and model to use. */
export function resolveBossAiProvider(): BossAiProvider | null {
  const explicit = process.env.BOSS_AI_PROVIDER?.trim().toLowerCase()
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY?.trim()
  const hasOpenAI = !!process.env.OPENAI_API_KEY?.trim()

  if (explicit === 'openai' && hasOpenAI) return 'openai'
  if (explicit === 'anthropic' && hasAnthropic) return 'anthropic'
  if (hasAnthropic) return 'anthropic'
  if (hasOpenAI) return 'openai'
  return null
}

export function getBossAiPublicConfig(): BossAiPublicConfig {
  const provider = resolveBossAiProvider()
  return {
    configured: provider !== null,
    provider,
  }
}

export function anthropicModel(): string {
  return process.env.BOSS_ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-6'
}

export function openaiModel(): string {
  return process.env.BOSS_OPENAI_MODEL?.trim() || 'gpt-4o-mini'
}
