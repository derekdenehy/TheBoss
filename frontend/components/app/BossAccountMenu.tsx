'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useAppState } from '@/context/AppStateContext'

function ProfileIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-4 6.5-6 8-6s6.5 2 8 6" />
    </svg>
  )
}

export function BossAccountMenu() {
  const { supabaseConfigured, authUser, signOut } = useAppState()
  const [open, setOpen] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const el = shellRef.current
      if (el && !el.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!supabaseConfigured) return null

  if (!authUser?.email) {
    return (
      <Link
        href="/login"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[var(--color-text-muted)] transition hover:border-sky-500/35 hover:bg-white/[0.07] hover:text-sky-200"
        title="Sign in"
        aria-label="Sign in to sync"
      >
        <ProfileIcon />
      </Link>
    )
  }

  return (
    <div ref={shellRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Account menu"
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
          open
            ? 'border-sky-500/45 bg-sky-500/15 text-sky-200'
            : 'border-white/10 bg-white/[0.04] text-[var(--color-text-muted)] hover:border-white/20 hover:bg-white/[0.07] hover:text-[var(--color-text-primary)]'
        }`}
      >
        <ProfileIcon />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-white/[0.1] bg-[var(--color-bg-deep)] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
          role="dialog"
          aria-label="Account"
        >
          <p
            className="truncate border-b border-white/[0.06] pb-2 text-[11px] text-[var(--color-text-faint)]"
            title={authUser.email}
          >
            {authUser.email}
          </p>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              void signOut()
            }}
            className="mt-2 w-full rounded-lg px-2 py-2 text-left text-xs text-rose-300/90 transition hover:bg-rose-500/10"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
