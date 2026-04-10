'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export function AccountPasswordClient() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  const configured = isSupabaseConfigured()

  useEffect(() => {
    if (!configured) {
      setChecking(false)
      return
    }
    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      setChecking(false)
      return
    }

    let cancelled = false

    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return
      setHasSession(!!session)
      setChecking(false)
    }

    void run()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setHasSession(!!session)
      }
      if (event === 'SIGNED_OUT') {
        setHasSession(false)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [configured])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = getSupabaseBrowserClient()
    if (!supabase || !hasSession) return
    if (password.length < 6) {
      setMessage('Use at least 6 characters.')
      return
    }

    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)

    if (error) {
      setMessage(error.message)
      return
    }
    setSuccess(true)
    setPassword('')
    setTimeout(() => {
      router.push('/boss')
      router.refresh()
    }, 1200)
  }

  if (!configured) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center px-6">
        <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_0%,rgba(56,189,248,0.08),transparent_55%)]" />
        <p className="relative z-10 text-sm text-[var(--color-text-muted)]">Supabase is not configured.</p>
        <Link href="/boss" className="relative z-10 mt-4 text-sm text-sky-400/90">
          ← Boss
        </Link>
      </main>
    )
  }

  if (checking) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center px-6">
        <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_0%,rgba(56,189,248,0.08),transparent_55%)]" />
        <p className="relative z-10 text-sm text-[var(--color-text-muted)]">Loading…</p>
      </main>
    )
  }

  if (!hasSession) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center px-6">
        <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_0%,rgba(56,189,248,0.08),transparent_55%)]" />
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.06] bg-[var(--color-bg-panel)]/80 p-8 text-center">
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Set a new password</h1>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            Open the link from your reset email (it signs you in briefly so you can update your password), or sign in
            first and open Change password from the login page.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/forgot-password"
              className="rounded-xl bg-sky-500/90 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              Request reset email
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-white/10 py-3 text-sm font-medium text-[var(--color-text-primary)] transition hover:bg-white/[0.04]"
            >
              Sign in
            </Link>
          </div>
          <Link href="/boss" className="mt-8 inline-block text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]">
            ← Back to Boss
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_0%,rgba(56,189,248,0.08),transparent_55%)]" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.06] bg-[var(--color-bg-panel)]/80 p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-400/80">The Boss</p>
        <h1 className="mt-2 text-xl font-semibold text-[var(--color-text-primary)]">New password</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Choose a strong password you haven’t used elsewhere.
        </p>

        {success ? (
          <p className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100/90">
            Password updated. Redirecting…
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                New password
              </label>
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full rounded-xl border border-white/10 bg-[var(--color-bg-deep)] py-2.5 pl-3 pr-[4.5rem] text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition hover:bg-white/[0.06] hover:text-[var(--color-text-primary)]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {message && <p className="text-sm text-rose-200/90">{message}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-sky-500/90 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}

        <Link
          href="/boss"
          className="mt-8 block text-center text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]"
        >
          ← Back to Boss
        </Link>
      </div>
    </main>
  )
}
