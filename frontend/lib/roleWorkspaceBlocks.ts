import { createId } from '@/lib/ids'
import { orderTasksForStatusColumn } from '@/lib/taskTree'
import type { Role, RoleWorkspaceBlock, Task } from '@/lib/types'

const LEGACY_NOTE_ID = 'legacy-workspace-note'
const legacyLinkId = (i: number) => `legacy-workspace-link-${i}`

/** Stored blocks, or legacy notes + links as stable placeholder blocks until saved. */
export function effectiveWorkspaceBlocks(role: Role): RoleWorkspaceBlock[] {
  if (role.workspaceBlocks && role.workspaceBlocks.length > 0) {
    return role.workspaceBlocks
  }
  const out: RoleWorkspaceBlock[] = []
  const note = role.workspaceNotes?.trim()
  if (note) {
    out.push({ id: LEGACY_NOTE_ID, type: 'text', body: note })
  }
  ;(role.workspaceResourceLinks ?? []).forEach((l, i) => {
    out.push({
      id: legacyLinkId(i),
      type: 'link',
      url: l.url,
      ...(l.label?.trim() ? { label: l.label.trim() } : {}),
    })
  })
  return out
}

/** Replace placeholder ids from legacy migration with real ids (once per block). */
export function persistableWorkspaceBlocks(blocks: RoleWorkspaceBlock[]): RoleWorkspaceBlock[] {
  return blocks.map((b) =>
    b.id === LEGACY_NOTE_ID || b.id.startsWith('legacy-workspace-link-')
      ? { ...b, id: createId() }
      : b
  )
}

function hasLegacyPlaceholderIds(blocks: RoleWorkspaceBlock[]): boolean {
  return blocks.some(
    (b) => b.id === LEGACY_NOTE_ID || b.id.startsWith('legacy-workspace-link-')
  )
}

/** Stable ids for normal edits; migrate legacy placeholders only when they are still present. */
export function finalizeWorkspaceBlocksForSave(blocks: RoleWorkspaceBlock[]): RoleWorkspaceBlock[] {
  return hasLegacyPlaceholderIds(blocks) ? persistableWorkspaceBlocks(blocks) : blocks
}

/**
 * Which in-progress task owns the role workspace (same pick as the primary title in the header).
 */
export function resolveWorkspaceAnchorTask(
  tasks: Task[],
  startHereTaskId: string | null
): Task | undefined {
  const rows = orderTasksForStatusColumn(tasks, 'in_progress')
  if (rows.length === 0) return undefined
  const start =
    startHereTaskId &&
    tasks.find((t) => t.id === startHereTaskId && t.status === 'in_progress')
  if (start) return start
  const roots = rows.filter((r) => r.depth === 0)
  if (roots.length >= 1) return roots[0].task
  return rows[0].task
}

/**
 * Blocks for the anchor task, or role-level legacy data shown until saved onto the task.
 */
export function effectiveTaskWorkspaceBlocks(
  anchor: Task | undefined,
  role: Role
): RoleWorkspaceBlock[] {
  if (!anchor) return []
  if (anchor.workspaceBlocks && anchor.workspaceBlocks.length > 0) {
    return anchor.workspaceBlocks
  }
  return effectiveWorkspaceBlocks(role)
}

export function safeHttpUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  try {
    const u = new URL(t.includes('://') ? t : `https://${t}`)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}
