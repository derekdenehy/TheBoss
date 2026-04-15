'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAppState } from '@/context/AppStateContext'
import { BossContextBrief } from '@/components/dashboard/BossContextBrief'
import { ConversationalOnboarding } from './ConversationalOnboarding'

export function AIContextPage() {
  const router = useRouter()
  const { hydrated, aiContextSetupComplete, setAIContextSetupComplete } = useAppState()

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--color-text-muted)]">
        Loading…
      </div>
    )
  }

  if (!aiContextSetupComplete) {
    return <ConversationalOnboarding />
  }

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/boss"
            className="text-xs text-[var(--color-text-faint)] transition hover:text-sky-300/90"
          >
            ← Boss
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-[var(--color-text-primary)]">Your context</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--color-text-muted)]">
            This is what Focus uses to orchestrate your day. There is no big form — you refine it by
            talking to Boss. Optional details like task style and common blockers get inferred over time;
            you can always mention them in Focus.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAIContextSetupComplete(false)
          }}
          className="rounded-xl border border-white/15 px-4 py-2 text-xs font-medium text-[var(--color-text-muted)] hover:bg-white/[0.04]"
        >
          Redo chat onboarding
        </button>
      </header>

      <BossContextBrief onJumpToChat={() => router.push('/boss')} />
    </div>
  )
}
