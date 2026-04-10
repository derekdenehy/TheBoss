'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Current `window.location.pathname`, updated on popstate and history API calls.
 * Use this instead of `next/navigation`’s `usePathname` in `/boss` layout UI so we never
 * depend on Next’s layout-router context (avoids “layout router to be mounted” crashes).
 */
export function useBrowserPathname(): string {
  const [pathname, setPathname] = useState('')

  const sync = useCallback(() => {
    if (typeof window === 'undefined') return
    const next = window.location.pathname
    setPathname((prev) => (prev !== next ? next : prev))
  }, [])

  useEffect(() => {
    sync()
    window.addEventListener('popstate', sync)
    const push = history.pushState.bind(history)
    const replace = history.replaceState.bind(history)
    history.pushState = function (
      this: History,
      ...args: Parameters<History['pushState']>
    ) {
      push(...args)
      queueMicrotask(sync)
    }
    history.replaceState = function (
      this: History,
      ...args: Parameters<History['replaceState']>
    ) {
      replace(...args)
      queueMicrotask(sync)
    }
    return () => {
      window.removeEventListener('popstate', sync)
      history.pushState = push
      history.replaceState = replace
    }
  }, [sync])

  return pathname
}
