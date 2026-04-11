'use client'

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppState } from '@/context/AppStateContext'
import { useBrowserPathname } from '@/hooks/useBrowserPathname'
import { BossChromeBar } from './BossChromeBar'
import { BossSidebar } from './BossSidebar'
import { BossWorkspaceEffects } from './BossWorkspaceEffects'

/** Boss chrome + children. Sidebar/effects avoid `usePathname` from `next/navigation` (see `useBrowserPathname`). */
export function BossLayoutClient({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = useBrowserPathname()
  const { hydrated, aiContextSetupComplete } = useAppState()

  const onContextRoute = pathname === '/boss/context'
  const pathnameReady = pathname.length > 0
  const mustFinishOnboarding =
    hydrated && pathnameReady && !aiContextSetupComplete && !onContextRoute

  useEffect(() => {
    if (mustFinishOnboarding) {
      router.replace('/boss/context')
    }
  }, [mustFinishOnboarding, router])

  const showRedirectPlaceholder = hydrated && pathnameReady && mustFinishOnboarding

  return (
    <div className="flex min-h-screen">
      <BossSidebar />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <BossWorkspaceEffects />
        <div className="pointer-events-none fixed inset-0 z-0 boss-ambient-gradient" />
        <BossChromeBar />
        <div className="relative z-10 flex-1 overflow-auto px-6 pb-8 pt-4">
          {!hydrated || (hydrated && !pathnameReady) ? (
            <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--color-text-muted)]">
              Loading…
            </div>
          ) : showRedirectPlaceholder ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Opening your context setup…
              </p>
              <p className="max-w-sm text-xs text-[var(--color-text-muted)]">
                New here? Boss needs a short brief first — profile, goals, and projects — then Focus and
                Chat can help you decide what to do.
              </p>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  )
}
