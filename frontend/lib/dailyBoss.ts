import type { DailyBossRoutine } from './types'

/** Local calendar date YYYY-MM-DD */
export function getTodayKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function emptyDailyBossRoutine(date: string): DailyBossRoutine {
  return {
    date,
    stateCheck: {
      unfinishedFromYesterday: '',
      urgent: '',
      blocked: '',
      energy: '',
      workingTime: '',
    },
    outcomes: [],
    activeRoleIds: [],
    rolePackets: {},
    startingRoleId: null,
    switchConditions: {},
    committedAt: null,
  }
}
