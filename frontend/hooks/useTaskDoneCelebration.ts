import { useCallback, useEffect, useRef, useState } from 'react'
import type { TaskStatus } from '@/lib/types'

/** Time task stays in old column: check fill + burst + row sinks toward Done. */
const EXPLODE_MS = 700
/** Landing motion in the Completed section after the task moves. */
const LAND_CELEBRATE_MS = 860

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Two-phase “done” animation: `completingId` (explosion at old row), then apply + `celebrateId` (land in Done).
 */
export function useTaskDoneCelebration() {
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [celebrateId, setCelebrateId] = useState<string | null>(null)
  const explodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const landTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (explodeTimer.current) {
      clearTimeout(explodeTimer.current)
      explodeTimer.current = null
    }
    if (landTimer.current) {
      clearTimeout(landTimer.current)
      landTimer.current = null
    }
  }, [])

  useEffect(() => {
    return () => clearTimers()
  }, [clearTimers])

  const submitStatus = useCallback(
    (
      taskId: string,
      next: TaskStatus,
      apply: (taskId: string, status: TaskStatus) => void
    ) => {
      if (next !== 'done') {
        clearTimers()
        setCompletingId(null)
        setCelebrateId(null)
        apply(taskId, next)
        return
      }

      clearTimers()
      setCelebrateId(null)

      if (prefersReducedMotion()) {
        apply(taskId, next)
        setCelebrateId(taskId)
        landTimer.current = setTimeout(() => {
          setCelebrateId(null)
          landTimer.current = null
        }, 280)
        return
      }

      setCompletingId(taskId)

      explodeTimer.current = setTimeout(() => {
        explodeTimer.current = null
        apply(taskId, next)
        setCompletingId(null)
        setCelebrateId(taskId)
        landTimer.current = setTimeout(() => {
          setCelebrateId(null)
          landTimer.current = null
        }, LAND_CELEBRATE_MS)
      }, EXPLODE_MS)
    },
    [clearTimers]
  )

  return { completingId, celebrateId, submitStatus }
}
