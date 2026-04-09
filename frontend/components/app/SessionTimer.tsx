'use client'

import { formatDuration } from '@/lib/earnings'

export function SessionTimer({ seconds }: { seconds: number }) {
  return (
    <span className="font-mono text-lg tabular-nums text-sky-200" suppressHydrationWarning>
      {formatDuration(seconds)}
    </span>
  )
}
