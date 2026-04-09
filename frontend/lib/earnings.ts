/** Coins earned for elapsed seconds at the given hourly rate. */
export function earningsForElapsedSeconds(
  elapsedSeconds: number,
  hourlyRate: number
): number {
  return (elapsedSeconds / 3600) * hourlyRate
}

export function formatCoins(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(1)
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m ${sec}s`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}
