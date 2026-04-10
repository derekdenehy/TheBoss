'use client'

import { useAppState } from '@/context/AppStateContext'
import { BossAccountMenu } from './BossAccountMenu'
import { CurrencyBadge } from './CurrencyBadge'

export function BossChromeBar() {
  const { hydrated, liveTotalCurrency } = useAppState()

  if (!hydrated) {
    return <div className="h-10 shrink-0" aria-hidden />
  }

  return (
    <div className="relative z-20 flex shrink-0 items-center justify-end gap-3 px-6 pt-6">
      <CurrencyBadge amount={liveTotalCurrency()} />
      <BossAccountMenu />
    </div>
  )
}
