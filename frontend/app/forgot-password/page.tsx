'use client'

import Link from 'next/link'
import { useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState('')

  const configured = isSupabaseConfigured()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      setMessage('Supabase is not configured.')
      return
    }
    const em = email.trim()
    if (!em) return

    setBusy(true)
    setMessage('')
    const origin = window.location.origin
    const { error } = await supabase.auth.resetPasswordForEmail(em, {
      redirectTo: `${origin}/auth/callback?next=/account/password`,
    })
    setBusy(false)
    if (error) {
      setMessage(error.message)
      return
    }
    setDone(true)
  }

  if (!configured) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center px-6">
        <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_0%,rgba(56,189,248,0.08),transparent_55%)]" />
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.06] bg-[var(--color-bg-panel)]/80 p-8 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">Supabase is not configured.</p>
          <Link href="/login" className="mt-4 inline-block text-sm text-sky-400/90">
            ← Back to sign in
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
        <h1 className="mt-2 text-xl font-semibold text-[var(--color-text-primary)]">Reset password</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Enter the email for your account. If it exists, we’ll send a link to choose a new password.
        </p>

        {done ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100/90">
              If an account exists for that address, you’ll get an email shortly. Open the link — it expires after a
              while — then set your new password on the next screen.
            </p>
            <Link
              href="/login"
              className="block w-full rounded-xl border border-white/10 py-3 text-center text-sm font-medium text-[var(--color-text-primary)] transition hover:bg-white/[0.04]"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
              />
            </div>
            {message && <p className="text-sm text-rose-200/90">{message}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-sky-500/90 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-8 block text-center text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]"
        >
          ← Back to sign in
        </Link>
      </div>
    </main>
  )
}
