'use client'

import { BossContextBrief } from './BossContextBrief'

function focusBossDashChatInput() {
  document.getElementById('boss-dash-chat-input')?.focus({ preventScroll: true })
}

/** Reference view of AI context (profile, goals, projects, working state). */
export function BossBriefTab() {
  return <BossContextBrief onJumpToChat={focusBossDashChatInput} />
}
