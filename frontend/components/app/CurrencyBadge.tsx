'use client'

import { formatCoins } from '@/lib/earnings'

export function CurrencyBadge({ amount }: { amount: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm font-semibold text-amber-200">
      <span aria-hidden>🪙</span>
      <span>{formatCoins(amount)} coins</span>
    </div>
  )
}
