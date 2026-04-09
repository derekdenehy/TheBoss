'use client'

import { useMemo, useState, type FormEvent } from 'react'
import type { KpiEntry } from '@/lib/types'
import { getTodayKey } from '@/lib/dailyBoss'
import { useAppState } from '@/context/AppStateContext'
import { KpiSparkline } from './KpiSparkline'

const DEFAULT_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6']

export function BossKpisTab() {
  const {
    kpiDefinitions,
    kpiEntries,
    addKpiDefinition,
    deleteKpiDefinition,
    setKpiEntry,
    deleteKpiEntry,
  } = useAppState()

  const [newLabel, setNewLabel] = useState('')
  const today = getTodayKey()

  const addKpi = (e: FormEvent) => {
    e.preventDefault()
    const label = newLabel.trim()
    if (!label) return
    const color = DEFAULT_COLORS[kpiDefinitions.length % DEFAULT_COLORS.length]
    addKpiDefinition({ label, color })
    setNewLabel('')
  }

  return (
    <div className="space-y-8">
      <form onSubmit={addKpi} className="panel-card flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-[12rem] flex-1 text-xs text-[var(--color-text-faint)]">
          New KPI label
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label"
            className="mt-1 w-full rounded-xl border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-sky-500/40"
          />
        </label>
        <button
          type="submit"
          className="rounded-xl bg-sky-500/90 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400"
        >
          Add KPI
        </button>
      </form>

      {kpiDefinitions.length === 0 ? (
        <div className="panel-card py-12 text-center text-sm text-[var(--color-text-muted)]">
          No KPIs yet.
        </div>
      ) : (
        <div className="space-y-6">
          {kpiDefinitions.map((k) => (
            <KpiDetailCard key={k.id} kpi={k} entries={kpiEntries.filter((e) => e.kpiId === k.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function KpiDetailCard({
  kpi,
  entries,
}: {
  kpi: { id: string; label: string; color?: string }
  entries: import('@/lib/types').KpiEntry[]
}) {
  const { setKpiEntry, deleteKpiDefinition, deleteKpiEntry } = useAppState()
  const today = getTodayKey()
  const [date, setDate] = useState(today)
  const [value, setValue] = useState('')

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date)),
    [entries]
  )

  const log = (e: FormEvent) => {
    e.preventDefault()
    const n = Number(value)
    if (Number.isNaN(n)) return
    setKpiEntry({ kpiId: kpi.id, date, value: n })
    setValue('')
  }

  return (
    <div className="panel-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{kpi.label}</h3>
          <div className="mt-3 max-w-md">
            <KpiSparkline entries={entries} color={kpi.color ?? '#38bdf8'} height={48} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Remove KPI "${kpi.label}" and all its data?`)) {
              deleteKpiDefinition(kpi.id)
            }
          }}
          className="text-xs text-rose-300/90 hover:underline"
        >
          Delete KPI
        </button>
      </div>

      <form onSubmit={log} className="mt-6 flex flex-wrap items-end gap-3 border-t border-white/[0.06] pt-5">
        <label className="text-xs text-[var(--color-text-faint)]">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm outline-none focus:border-sky-500/40"
          />
        </label>
        <label className="text-xs text-[var(--color-text-faint)]">
          Value
          <input
            type="number"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            className="mt-1 block w-28 rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-3 py-2 text-sm outline-none focus:border-sky-500/40"
          />
        </label>
        <button
          type="submit"
          className="rounded-xl bg-white/[0.08] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-white/[0.12]"
        >
          Save point
        </button>
      </form>

      {sorted.length > 0 && (
        <ul className="mt-4 max-h-40 overflow-y-auto text-sm">
          {sorted.slice(0, 12).map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between border-b border-white/[0.04] py-2 text-[var(--color-text-muted)]"
            >
              <span>{row.date}</span>
              <span className="flex items-center gap-3">
                <span className="font-mono tabular-nums text-[var(--color-text-primary)]">
                  {row.value.toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => deleteKpiEntry(row.id)}
                  className="text-xs text-rose-300/80 hover:underline"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
