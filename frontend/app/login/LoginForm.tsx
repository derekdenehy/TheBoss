'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'

type Mode = 'signin' | 'signup'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const err = searchParams.get('error')
  const [mode, setMode] = useState<Mode>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const configured = isSupabaseConfigured()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      setMessage('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
      return
    }
    const em = email.trim()
    if (!em) {
      setMessage('Enter your email.')
      return
    }
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.')
      return
    }

    setBusy(true)
    setMessage('')

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password })
        if (error) {
          setMessage(error.message)
          return
        }
        router.push('/boss')
        router.refresh()
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email: em,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/boss`,
        },
      })
      if (error) {
        setMessage(error.message)
        return
      }
      if (data.session) {
        router.push('/boss')
        router.refresh()
        return
      }
      if (data.user) {
        setMessage(
          'Account created. Check your email to confirm, then sign in — or disable “Confirm email” in Supabase for instant access.'
        )
        setMode('signin')
        return
      }
      setMessage('Could not create account. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!configured) {
    return (
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.06] bg-[var(--color-bg-panel)]/80 p-8 text-center">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Supabase not configured</h1>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          Copy <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">supabase.env.template</code> to{' '}
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">.env.local</code> in this folder and add your
          project URL and anon key.
        </p>
        <Link
          href="/boss"
          className="mt-6 inline-block text-sm text-sky-400/90 hover:text-sky-300"
        >
          Continue to Boss →
        </Link>
      </div>
    )
  }

  return (
    <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.06] bg-[var(--color-bg-panel)]/80 p-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-sky-400/80">The Boss</p>
      <h1 className="mt-2 text-xl font-semibold text-[var(--color-text-primary)]">
        {mode === 'signin' ? 'Sign in' : 'Create account'}
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Email and password. Your data syncs after you sign in.
      </p>

      {err === 'auth' && (
        <p className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200/90">
          That sign-in link didn’t work. Use email and password here instead, or try again from your email.
        </p>
      )}
      {err === 'config' && (
        <p className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
          Server missing Supabase configuration.
        </p>
      )}

      <div className="mt-6 flex rounded-xl border border-white/10 p-0.5 text-xs font-medium">
        <button
          type="button"
          onClick={() => {
            setMode('signup')
            setMessage('')
          }}
          className={`flex-1 rounded-lg py-2 transition ${
            mode === 'signup'
              ? 'bg-white/10 text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          Create account
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('signin')
            setMessage('')
          }}
          className={`flex-1 rounded-lg py-2 transition ${
            mode === 'signin'
              ? 'bg-white/10 text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          Sign in
        </button>
      </div>

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
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            Password
          </label>
          <div className="relative mt-1.5">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
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
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-sky-500/90 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
        >
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      {message && (
        <p
          className={`mt-4 text-sm ${
            message.startsWith('Account created') || message.includes('Check your email')
              ? 'text-[var(--color-text-muted)]'
              : 'text-rose-200/90'
          }`}
        >
          {message}
        </p>
      )}

      <div className="mt-8 border-t border-white/[0.06] pt-6 text-center">
        <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-faint)]">
          Password
        </p>
        <div className="mt-3 flex flex-col gap-2 text-xs">
          <Link
            href="/forgot-password"
            className="rounded-lg py-2 text-sky-400/90 transition hover:bg-white/[0.04] hover:text-sky-300"
          >
            Forgot password
          </Link>
          <Link
            href="/account/password"
            className="rounded-lg py-2 text-[var(--color-text-muted)] transition hover:bg-white/[0.04] hover:text-[var(--color-text-primary)]"
          >
            Change password
          </Link>
        </div>
      </div>

      <Link
        href="/boss"
        className="mt-6 block text-center text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]"
      >
        ← Back to Boss
      </Link>
    </div>
  )
}
