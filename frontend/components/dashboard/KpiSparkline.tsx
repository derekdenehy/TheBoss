'use client'

import type { KpiEntry } from '@/lib/types'

type Props = {
  entries: KpiEntry[]
  color?: string
  height?: number
  className?: string
}

/** Lightweight SVG trend — no charting dependency. */
export function KpiSparkline({ entries, color = '#38bdf8', height = 40, className = '' }: Props) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-20)
  if (sorted.length === 0) {
    return (
      <div
        className={`flex items-center text-xs text-[var(--color-text-faint)] ${className}`}
        style={{ height }}
      >
        No entries yet
      </div>
    )
  }

  const w = 120
  const h = height
  const pad = 2
  const values = sorted.map((e) => e.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = sorted
    .map((e, i) => {
      const x =
        sorted.length <= 1 ? w / 2 : pad + (i / (sorted.length - 1)) * (w - pad * 2)
      const y = pad + (1 - (e.value - min) / range) * (h - pad * 2)
      return `${x},${y}`
    })
    .join(' ')

  const last = sorted[sorted.length - 1]

  return (
    <div className={`flex items-end gap-2 ${className}`}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          opacity={0.9}
        />
        {sorted.map((e, i) => {
          const x =
            sorted.length <= 1 ? w / 2 : pad + (i / (sorted.length - 1)) * (w - pad * 2)
          const y = pad + (1 - (e.value - min) / range) * (h - pad * 2)
          return <circle key={e.id} cx={x} cy={y} r={2.5} fill={color} />
        })}
      </svg>
      <div className="pb-0.5 text-right">
        <p className="text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">
          {last.value.toLocaleString()}
        </p>
        <p className="text-[10px] text-[var(--color-text-faint)]">last · {last.date}</p>
      </div>
    </div>
  )
}
