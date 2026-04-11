'use client'

import type { ReactNode } from 'react'
import { BossChromeBar } from './BossChromeBar'
import { BossSidebar } from './BossSidebar'
import { BossWorkspaceEffects } from './BossWorkspaceEffects'

/** Boss chrome + children. Sidebar/effects avoid `usePathname` from `next/navigation` (see `useBrowserPathname`). */
export function BossLayoutClient({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <BossSidebar />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <BossWorkspaceEffects />
        <div className="pointer-events-none fixed inset-0 z-0 boss-ambient-gradient" />
        <BossChromeBar />
        <div className="relative z-10 flex-1 overflow-auto px-6 pb-8 pt-4">
          {children}
        </div>
      </div>
    </div>
  )
}
