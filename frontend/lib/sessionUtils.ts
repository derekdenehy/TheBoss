import { earningsForElapsedSeconds } from '@/lib/earnings'
import type { Role, Session } from '@/lib/types'
import { DEFAULT_HOURLY_RATE } from '@/lib/types'

/** Active sessions use route-based billing only when this is true (see `billableMsAccrued`). */
export function usesRouteBilling(session: Pick<Session, 'billableMsAccrued'>): boolean {
  return typeof session.billableMsAccrued === 'number'
}

export type SessionBillingContext = {
  focusRoleId: string | null
  segmentStartedAt: number | null
}

export function finalizeSessionSnapshot(
  session: Session,
  roles: Role[],
  endMs: number = Date.now(),
  billing?: SessionBillingContext | null
): Session {
  const start = new Date(session.startTime).getTime()
  let durationSeconds: number
  if (usesRouteBilling(session)) {
    let ms = session.billableMsAccrued ?? 0
    if (
      billing &&
      session.roleId === billing.focusRoleId &&
      billing.segmentStartedAt != null
    ) {
      ms += Math.max(0, endMs - billing.segmentStartedAt)
    }
    durationSeconds = Math.max(0, Math.floor(ms / 1000))
  } else {
    durationSeconds = Math.max(0, Math.floor((endMs - start) / 1000))
  }
  const role = roles.find((r) => r.id === session.roleId)
  const rate = role?.hourlyRate ?? DEFAULT_HOURLY_RATE
  const earnings = earningsForElapsedSeconds(durationSeconds, rate)
  return {
    ...session,
    endTime: new Date(endMs).toISOString(),
    durationSeconds,
    earnings,
    active: false,
    billableMsAccrued: undefined,
  }
}
