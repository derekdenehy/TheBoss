'use client'

import type { CSSProperties } from 'react'

const DOTS = 10

type Props = {
  className?: string
}

/** Check + particle burst for “marking done” (position inside `relative` parent). */
export function TaskDoneBurst({ className = '' }: Props) {
  return (
    <span className={`task-done-burst-root pointer-events-none ${className}`} aria-hidden>
      <span className="task-done-burst-ring" />
      <span className="task-done-burst-core">
        <svg viewBox="0 0 24 24" className="task-done-burst-check" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path className="task-done-burst-check-path" d="M6 12l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {Array.from({ length: DOTS }, (_, i) => (
        <span
          key={i}
          className="task-done-burst-dot"
          style={{ '--burst-i': i } as CSSProperties}
        />
      ))}
    </span>
  )
}
