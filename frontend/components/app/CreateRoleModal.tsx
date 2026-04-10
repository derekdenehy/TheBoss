'use client'

import { useState } from 'react'
import { DEFAULT_HOURLY_RATE } from '@/lib/types'

const PRESET_COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#4ade80', '#fb923c']

type Props = {
  open: boolean
  onClose: () => void
  onCreate: (input: { name: string; color?: string; hourlyRate: number }) => boolean
}

export function CreateRoleModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [hourlyRate, setHourlyRate] = useState(String(DEFAULT_HOURLY_RATE))
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const submit = () => {
    setError(null)
    const rate = Number(hourlyRate)
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (Number.isNaN(rate) || rate < 0) {
      setError('Rate must be a positive number.')
      return
    }
    const ok = onCreate({ name: name.trim(), color, hourlyRate: rate })
    if (!ok) {
      setError('A role with that name already exists.')
      return
    }
    setName('')
    setHourlyRate(String(DEFAULT_HOURLY_RATE))
    setColor(PRESET_COLORS[0])
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-role-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="panel-card relative z-10 max-w-md w-full p-6 shadow-2xl">
        <h2 id="create-role-title" className="text-lg font-bold text-[var(--color-text-primary)]">
          New role
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Name your &quot;hat&quot; and set how many dollars you earn per hour while clocked in.
        </p>

        <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          Name
        </label>
        <input
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/50"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Engineer, Marketing, CEO…"
          autoFocus
        />

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          Dollars per hour
        </label>
        <input
          type="number"
          min={0}
          step={1}
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/50"
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
        />

        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          Color
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`h-9 w-9 rounded-lg border-2 transition ${
                color === c ? 'border-white' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-[var(--color-text-muted)] transition hover:bg-white/5"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-xl bg-sky-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
            onClick={submit}
          >
            Create role
          </button>
        </div>
      </div>
    </div>
  )
}
