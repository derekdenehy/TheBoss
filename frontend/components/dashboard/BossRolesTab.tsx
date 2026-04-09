'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAppState } from '@/context/AppStateContext'
import type { Role } from '@/lib/types'

function RoleNameEditor({ role }: { role: Role }) {
  const { updateRole } = useAppState()
  const [name, setName] = useState(role.name)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(role.name)
    setError(null)
  }, [role.id, role.name])

  const commit = () => {
    const next = name.trim()
    if (next === role.name) {
      setError(null)
      return
    }
    if (!next) {
      setName(role.name)
      setError(null)
      return
    }
    const ok = updateRole(role.id, { name: next })
    if (!ok) {
      setError('That name is already used')
      setName(role.name)
    } else {
      setError(null)
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <input
        className="w-full min-w-0 rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setError(null)
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            setName(role.name)
            setError(null)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        aria-label={`Rename ${role.name}`}
      />
      {error && <p className="text-xs text-rose-300/90">{error}</p>}
    </div>
  )
}

export function BossRolesTab() {
  const { roles } = useAppState()
  const sorted = [...roles].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {sorted.map((role) => {
          const dot = role.color || '#64748b'
          return (
            <li
              key={role.id}
              className="panel-card flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: dot }}
                aria-hidden
              />
              <RoleNameEditor role={role} />
              <Link
                href={`/boss/role/${role.id}`}
                className="shrink-0 text-xs font-medium text-sky-300 hover:underline sm:ml-auto"
              >
                Open workspace →
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
