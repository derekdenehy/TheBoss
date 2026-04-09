'use client'

import { useEffect, useState } from 'react'
import { formatTaskDuration, getTaskElapsedSeconds } from '@/lib/taskTime'
import type { Task } from '@/lib/types'

type Props = {
  task: Task
  className?: string
}

/** Live-updating duration while in progress; frozen total when todo/done. */
export function TaskDuration({ task, className = '' }: Props) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (task.status !== 'in_progress') return
    const id = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [task.status, task.id, task.inProgressStartedAt])

  void tick
  const seconds = getTaskElapsedSeconds(task)
  const showDash =
    seconds === 0 && task.status !== 'in_progress'

  return (
    <span
      className={`font-mono text-xs tabular-nums ${showDash ? 'text-[var(--color-text-faint)]' : 'text-[var(--color-text-muted)]'} ${className}`}
      title="Time spent while this task was in progress"
    >
      {showDash ? '—' : formatTaskDuration(seconds)}
    </span>
  )
}
