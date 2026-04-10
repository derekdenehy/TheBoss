'use client'

import { useEffect } from 'react'
import { useBrowserPathname } from '@/hooks/useBrowserPathname'
import { useAppState } from '@/context/AppStateContext'

function isBossDashboardPath(pathname: string | null): boolean {
  if (!pathname) return false
  if (pathname === '/boss') return true
  if (pathname === '/boss/') return true
  return false
}

/** Billing focus, Boss window session, and `data-arena` for `/boss/*` (used inside `BossLayoutClient`). */
export function BossWorkspaceEffects() {
  const pathname = useBrowserPathname()
  const { hydrated, syncBillingFocusFromPath, beginBossWindowSession, endBossWindowSession } =
    useAppState()

  useEffect(() => {
    if (!hydrated) return
    beginBossWindowSession()
    return () => endBossWindowSession()
  }, [hydrated, beginBossWindowSession, endBossWindowSession])

  useEffect(() => {
    if (!hydrated) return
    syncBillingFocusFromPath(pathname || null)
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

  return null
}
