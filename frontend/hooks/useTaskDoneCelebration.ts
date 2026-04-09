import { useCallback, useEffect, useRef, useState } from 'react'
import type { TaskStatus } from '@/lib/types'

const CELEBRATE_MS = 720

/**
 * Brief “completed” animation: set `celebrateId` when moving a task to done, then clear.
 */
export function useTaskDoneCelebration() {
  const [celebrateId, setCelebrateId] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const submitStatus = useCallback(
    (
      taskId: string,
      next: TaskStatus,
      apply: (taskId: string, status: TaskStatus) => void
    ) => {
      if (next === 'done') {
        if (timer.current) clearTimeout(timer.current)
        setCelebrateId(taskId)
        apply(taskId, next)
        timer.current = setTimeout(() => {
          setCelebrateId(null)
          timer.current = null
        }, CELEBRATE_MS)
      } else {
        apply(taskId, next)
      }
    },
    []
  )

  return { celebrateId, submitStatus }
}
