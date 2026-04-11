'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useAppState } from '@/context/AppStateContext'
import { useBrowserPathname } from '@/hooks/useBrowserPathname'
import { CreateRoleModal } from './CreateRoleModal'

function ClockedInIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

export function BossSidebar() {
  const pathname = useBrowserPathname()
  const {
    roles,
    sessions,
    addRole,
    todayBossRoutine,
    isBossDayCommitted,
    supabaseConfigured,
    authUser,
  } = useAppState()
  const [createOpen, setCreateOpen] = useState(false)

  const clockedRoleIds = useMemo(
    () => new Set(sessions.filter((s) => s.active).map((s) => s.roleId)),
    [sessions]
  )

  const sortedRoles = useMemo(
    () => [...roles].sort((a, b) => a.name.localeCompare(b.name)),
    [roles]
  )

  const sidebarRoles = useMemo(() => {
    let list: typeof sortedRoles
    if (
      !isBossDayCommitted ||
      !todayBossRoutine?.activeRoleIds?.length
    ) {
      list = sortedRoles
    } else {
      list = todayBossRoutine.activeRoleIds
        .map((id) => sortedRoles.find((r) => r.id === id))
        .filter((r): r is (typeof sortedRoles)[number] => r !== undefined)
    }
    const clocked: typeof list = []
    const rest: typeof list = []
    for (const r of list) {
      if (clockedRoleIds.has(r.id)) clocked.push(r)
      else rest.push(r)
    }
    return [...clocked, ...rest]
  }, [isBossDayCommitted, todayBossRoutine, sortedRoles, clockedRoleIds])

  const bossActive = pathname === '/boss'

  return (
    <>
      <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-white/[0.06] bg-[var(--color-bg-panel)]/50 px-4 py-6">
        <Link
          href="/boss"
          className={`group mx-auto flex h-36 w-36 flex-col items-center justify-center rounded-full border-2 text-center transition ${
            bossActive
              ? 'border-sky-400/70 bg-sky-500/15 shadow-[0_0_40px_rgba(56,189,248,0.12)]'
              : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
          }`}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-faint)]">
            Boss
          </span>
          <span className="mt-2 text-3xl leading-none" aria-hidden>
            ◉
          </span>
          <span className="mt-2 text-[10px] text-[var(--color-text-muted)]">Dashboard</span>
        </Link>

        <div className="mt-8 flex items-center justify-between px-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
            {isBossDayCommitted && todayBossRoutine?.activeRoleIds?.length
              ? "Today's roles"
              : 'Roles'}
          </span>
        </div>
        <nav className="mt-2 flex-1 overflow-y-auto">
          <ul className="space-y-0.5">
            {sidebarRoles.map((role) => {
              const href = `/boss/role/${role.id}`
              const active = pathname === href
              const dot = role.color || '#64748b'
              const clocked = clockedRoleIds.has(role.id)
              const accruing = clocked && active
              return (
                <li key={role.id}>
                  <Link
                    href={href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                      active
                        ? 'bg-white/[0.08] text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-muted)] hover:bg-white/[0.04] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: dot }}
                    />
                    <span className="min-w-0 flex-1 truncate">{role.name}</span>
                    {clocked && (
                      <span
                        className={`shrink-0 ${accruing ? 'text-emerald-400/95' : 'text-rose-400/95'}`}
                        title={
                          accruing
                            ? 'Clocked in — time accruing (this role tab is open)'
                            : 'Clocked in — timer paused (open this role to accrue time)'
                        }
                        aria-label={
                          accruing
                            ? 'Clocked in, time accruing'
                            : 'Clocked in, timer paused until this role is open'
                        }
                      >
                        <ClockedInIcon />
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="mt-4 w-full rounded-xl border border-dashed border-white/15 py-2.5 text-xs font-medium text-[var(--color-text-muted)] transition hover:border-sky-500/40 hover:text-sky-200"
        >
          + New role
        </button>

        <Link
          href="/boss/context"
          className="mt-2 block w-full rounded-xl border border-white/[0.08] py-2.5 text-center text-xs font-medium text-[var(--color-text-muted)] transition hover:border-sky-500/35 hover:text-sky-200/90"
        >
          AI Studio
        </Link>

        {supabaseConfigured && !authUser?.email && (
          <div className="mt-4 border-t border-white/[0.06] pt-4 text-[10px] text-[var(--color-text-muted)]">
            <Link
              href="/login"
              className="block w-full rounded-lg py-2 text-center text-sky-400/90 transition hover:bg-white/[0.04] hover:text-sky-300"
            >
              Sign in to sync
            </Link>
          </div>
        )}

        <Link
          href="/"
          className="mt-6 text-center text-[10px] text-[var(--color-text-faint)] transition hover:text-[var(--color-text-muted)]"
        >
          ← Progress
        </Link>
      </aside>

      <CreateRoleModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(input) => addRole(input)}
      />
    </>
  )
}
