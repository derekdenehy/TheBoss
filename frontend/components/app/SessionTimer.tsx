'use client'

import { formatDuration } from '@/lib/earnings'

export function SessionTimer({
  seconds,
  className = 'font-mono text-lg tabular-nums text-sky-200',
}: {
  seconds: number
  className?: string
}) {
  return (
    <span className={className} suppressHydrationWarning>
      {formatDuration(seconds)}
    </span>
  )
}
