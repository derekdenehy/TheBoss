import { Suspense } from 'react'
import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_0%,rgba(56,189,248,0.08),transparent_55%)]" />
      <Suspense
        fallback={
          <div className="relative z-10 text-sm text-[var(--color-text-muted)]">Loading…</div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  )
}
