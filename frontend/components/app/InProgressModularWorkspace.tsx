'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { safeHttpUrl } from '@/lib/roleWorkspaceBlocks'
import { createId } from '@/lib/ids'
import type { RoleWorkspaceBlock } from '@/lib/types'

const MAX_FILE_BYTES = 1_500_000

type Props = {
  blocks: RoleWorkspaceBlock[]
  onUpdateBlocks: (next: RoleWorkspaceBlock[]) => void
  onAddInProgressStep: (title: string) => void
  stepHint: string
}

export function InProgressModularWorkspace({
  blocks,
  onUpdateBlocks,
  onAddInProgressStep,
  stepHint,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const blocksRef = useRef(blocks)
  useEffect(() => {
    blocksRef.current = blocks
  }, [blocks])

  const [adder, setAdder] = useState<null | 'link' | 'step'>(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [stepTitle, setStepTitle] = useState('')

  const patchBlock = useCallback(
    (id: string, fn: (b: RoleWorkspaceBlock) => RoleWorkspaceBlock) => {
      onUpdateBlocks(blocks.map((b) => (b.id === id ? fn(b) : b)))
    },
    [blocks, onUpdateBlocks]
  )

  const removeBlock = useCallback(
    (id: string) => {
      onUpdateBlocks(blocks.filter((b) => b.id !== id))
    },
    [blocks, onUpdateBlocks]
  )

  const addText = () => {
    onUpdateBlocks([...blocks, { id: createId(), type: 'text', body: '' }])
  }

  const addLink = (e: FormEvent) => {
    e.preventDefault()
    const href = safeHttpUrl(linkUrl)
    if (!href) return
    const label = linkLabel.trim()
    onUpdateBlocks([
      ...blocks,
      { id: createId(), type: 'link', url: href, ...(label ? { label } : {}) },
    ])
    setLinkUrl('')
    setLinkLabel('')
    setAdder(null)
  }

  const onPickFile = () => fileRef.current?.click()

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      window.alert(
        `That file is too large for browser storage (${Math.round(file.size / 1024)} KB). Max about ${Math.round(MAX_FILE_BYTES / 1024)} KB — use a link instead.`
      )
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      if (!dataUrl) return
      onUpdateBlocks([
        ...blocksRef.current,
        {
          id: createId(),
          type: 'file',
          name: file.name,
          mimeType: file.type || undefined,
          dataUrl,
        },
      ])
    }
    reader.readAsDataURL(file)
  }

  const submitStep = (e: FormEvent) => {
    e.preventDefault()
    const t = stepTitle.trim()
    if (!t) return
    onAddInProgressStep(t)
    setStepTitle('')
    setAdder(null)
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={onFileChange}
        aria-hidden
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addText}
          className="rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-white/[0.07]"
        >
          + Note
        </button>
        <button
          type="button"
          onClick={() => setAdder((a) => (a === 'link' ? null : 'link'))}
          className="rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-white/[0.07]"
        >
          + Link
        </button>
        <button
          type="button"
          onClick={onPickFile}
          className="rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-white/[0.07]"
        >
          + File
        </button>
        <button
          type="button"
          onClick={() => setAdder((a) => (a === 'step' ? null : 'step'))}
          className="rounded-lg border border-amber-500/30 bg-amber-500/15 px-2.5 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/25"
        >
          + Step
        </button>
      </div>

      {adder === 'link' && (
        <form
          onSubmit={addLink}
          className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/25 p-3 sm:flex-row sm:items-end"
        >
          <input
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] outline-none focus:border-amber-500/40"
            placeholder="https://…"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            autoFocus
            aria-label="Link URL"
          />
          <input
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] outline-none focus:border-amber-500/40"
            placeholder="Label (optional)"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            aria-label="Link label"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-amber-500/85 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400"
            >
              Add
            </button>
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-xs text-[var(--color-text-muted)] hover:bg-white/[0.05]"
              onClick={() => setAdder(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {adder === 'step' && (
        <form onSubmit={submitStep} className="space-y-1.5 rounded-xl border border-amber-500/25 bg-black/20 p-3">
          <input
            className="w-full rounded-lg border border-white/10 bg-[var(--color-bg-deep)] px-2.5 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-amber-500/45"
            placeholder="Smallest next move…"
            value={stepTitle}
            onChange={(e) => setStepTitle(e.target.value)}
            autoFocus
            aria-label="New in-progress step"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-[var(--color-text-faint)]">{stepHint}</p>
            <button
              type="button"
              className="shrink-0 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              onClick={() => setAdder(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {blocks.length === 0 && !adder && (
        <p className="text-sm text-[var(--color-text-faint)]">
          Add notes, links, or files when you need them — nothing is required up front.
        </p>
      )}

      {blocks.length > 0 && (
        <ul className="space-y-2">
          {blocks.map((b) => (
            <li
              key={b.id}
              className="group relative rounded-xl border border-white/[0.08] bg-black/20 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-faint)]">
                  {b.type === 'text' ? 'Note' : b.type === 'link' ? 'Link' : 'File'}
                </span>
                <button
                  type="button"
                  className="rounded-md px-2 py-0.5 text-[11px] text-rose-300/90 opacity-80 hover:bg-rose-500/15 hover:opacity-100"
                  onClick={() => removeBlock(b.id)}
                >
                  Remove
                </button>
              </div>
              {b.type === 'text' && (
                <textarea
                  className="min-h-[4rem] w-full resize-y bg-transparent text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-faint)]"
                  placeholder="Write anything useful…"
                  value={b.body}
                  onChange={(e) =>
                    patchBlock(b.id, () => ({ ...b, body: e.target.value }))
                  }
                  aria-label="Note"
                />
              )}
              {b.type === 'link' && (
                <div className="min-w-0">
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-sm text-sky-300/95 hover:underline"
                  >
                    {b.label?.trim() || (() => {
                      try {
                        return new URL(b.url).hostname
                      } catch {
                        return b.url
                      }
                    })()}
                  </a>
                  <p className="mt-1 truncate text-[11px] text-[var(--color-text-faint)]">{b.url}</p>
                </div>
              )}
              {b.type === 'file' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-[var(--color-text-primary)]">{b.name}</span>
                  <a
                    href={b.dataUrl}
                    download={b.name}
                    className="text-xs font-medium text-amber-200/90 hover:underline"
                  >
                    Download
                  </a>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
