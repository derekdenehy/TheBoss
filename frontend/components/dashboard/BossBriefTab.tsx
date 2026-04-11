'use client'

import type { BossTab } from './bossDashboardTabs'
import { BossContextBrief } from './BossContextBrief'

type Props = {
  setTab: (t: BossTab) => void
}

/** Reference view of AI context (profile, goals, projects, working state) — same structure Focus uses. */
export function BossBriefTab({ setTab }: Props) {
  return <BossContextBrief onOpenFocus={() => setTab('chat')} />
}
