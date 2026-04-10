'use client'

import { formatCoins } from '@/lib/earnings'

function BanknoteGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <circle cx="12" cy="12" r="3.25" />
    </svg>
  )
}

export function CurrencyBadge({ amount }: { amount: number }) {
  const formatted = formatCoins(amount)
  const a11y = `Balance ${formatted}`
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-100"
      title={a11y}
      aria-label={a11y}
    >
      <BanknoteGlyph className="shrink-0 text-emerald-300/90" />
      <span className="tabular-nums">{formatted}</span>
    </div>
  )
}
