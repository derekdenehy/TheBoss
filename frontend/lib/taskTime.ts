import type { Task } from './types'

/** Total seconds logged for a task, including an open in-progress stint. */
export function getTaskElapsedSeconds(task: Task, atMs: number = Date.now()): number {
  const base = task.totalSecondsSpent ?? 0
  if (task.status !== 'in_progress' || !task.inProgressStartedAt) return base
  const start = new Date(task.inProgressStartedAt).getTime()
  if (Number.isNaN(start)) return base
  return base + Math.max(0, Math.floor((atMs - start) / 1000))
}

export function formatTaskDuration(seconds: number): string {
  const sec = Math.max(0, Math.floor(seconds))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
