'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { useAppState } from '@/context/AppStateContext'
import { BossSidebar } from './BossSidebar'

/** Red “Boss” theme only on the dashboard (`/boss`), not on role workspaces. */
function isBossDashboardPath(pathname: string | null): boolean {
  if (!pathname) return false
  if (pathname === '/boss') return true
  if (pathname === '/boss/') return true
  return false
}

export function BossLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { hydrated, syncBillingFocusFromPath, beginBossWindowSession, endBossWindowSession } =
    useAppState()

  useEffect(() => {
    if (!hydrated) return
    beginBossWindowSession()
    return () => endBossWindowSession()
  }, [hydrated, beginBossWindowSession, endBossWindowSession])

  useEffect(() => {
    if (!hydrated) return
    syncBillingFocusFromPath(pathname ?? null)
  }, [hydrated, pathname, syncBillingFocusFromPath])

  useEffect(() => {
    return () => {
      syncBillingFocusFromPath(null)
    }
  }, [syncBillingFocusFromPath])

  useEffect(() => {
    if (isBossDashboardPath(pathname)) {
      document.documentElement.setAttribute('data-arena', 'boss')
    } else {
      document.documentElement.removeAttribute('data-arena')
    }
    return () => document.documentElement.removeAttribute('data-arena')
  }, [pathname])

  return (
    <div className="flex min-h-screen">
      <BossSidebar />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="pointer-events-none fixed inset-0 z-0 boss-ambient-gradient" />
        <div className="relative z-10 flex-1 overflow-auto px-6 py-8">{children}</div>
      </div>
    </div>
  )
}
