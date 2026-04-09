'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { formatCoins } from '@/lib/earnings'
import { useAppState } from '@/context/AppStateContext'
import { SessionTimer } from './SessionTimer'

type StripProps = { className?: string }

/** Lists every role currently clocked in (multi-tasking). */
export function ActiveSessionsStrip({ className = '' }: StripProps) {
  const pathname = usePathname()
  const {
    sessions,
    getRoleById,
    liveElapsedSecondsForRole,
    liveSessionEarningsForRole,
  } = useAppState()

  const billingRoleId = useMemo(() => {
    const m = pathname?.match(/^\/boss\/role\/([^/]+)/)
    return m?.[1] ?? null
  }, [pathname])

  const rows = useMemo(() => {
    return sessions
      .filter((s) => s.active)
      .map((s) => {
        const role = getRoleById(s.roleId)
        return role ? { session: s, role } : null
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }, [sessions, getRoleById])

  if (rows.length === 0) return null

  return (
    <div className={`space-y-2 ${className}`}>
      {rows.map(({ session, role }) => {
        const accruing = billingRoleId === role.id
        return (
        <div
          key={session.id}
          className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-5 py-3 text-sm ${
            accruing
              ? 'border-emerald-500/25 bg-emerald-500/10'
              : 'border-rose-500/25 bg-rose-500/10'
          }`}
        >
          <span className="text-[var(--color-text-muted)]">
            {accruing ? 'On the clock ·' : 'Paused (open role tab) ·'}
          </span>
          <span className={`font-medium ${accruing ? 'text-emerald-200' : 'text-rose-200'}`}>
            {role.name}
          </span>
          <span
            className={`font-mono ${accruing ? 'text-emerald-100/90' : 'text-rose-100/90'}`}
          >
            <SessionTimer seconds={liveElapsedSecondsForRole(role.id)} />
          </span>
          <span className={`font-mono ${accruing ? 'text-amber-200' : 'text-amber-200/80'}`}>
            🪙 {formatCoins(liveSessionEarningsForRole(role.id))}
          </span>
          <Link
            href={`/boss/role/${role.id}`}
            className="text-xs font-medium text-sky-300 hover:underline"
          >
            Open →
          </Link>
        </div>
        )
      })}
    </div>
  )
}
