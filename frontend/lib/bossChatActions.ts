import type { Role } from '@/lib/types'

export type ParsedCreateTask = {
  roleName: string
  title: string
  dueAt?: string
}

/**
 * Strips a trailing machine-readable line from Boss replies:
 * BOSS_ACTIONS_JSON: [{"type":"create_task","roleName":"…","title":"…","dueAt":null}]
 */
export function parseBossAssistantReply(raw: string): {
  visibleText: string
  createTasks: ParsedCreateTask[]
} {
  const trimmed = raw.trimEnd()
  const nlIdx = trimmed.lastIndexOf('\nBOSS_ACTIONS_JSON:')
  let jsonSlice: string | null = null
  let visibleEnd = trimmed.length

  if (nlIdx >= 0) {
    visibleEnd = nlIdx
    jsonSlice = trimmed.slice(nlIdx + '\nBOSS_ACTIONS_JSON:'.length).trim()
  } else if (/^BOSS_ACTIONS_JSON:\s*/i.test(trimmed)) {
    const m = trimmed.match(/^BOSS_ACTIONS_JSON:\s*/i)
    const prefixLen = m?.[0].length ?? 0
    visibleEnd = 0
    jsonSlice = trimmed.slice(prefixLen).trim()
  }

  if (jsonSlice === null) {
    return { visibleText: trimmed, createTasks: [] }
  }

  const visibleText = trimmed.slice(0, visibleEnd).trimEnd()
  const createTasks: ParsedCreateTask[] = []

  try {
    const parsed = JSON.parse(jsonSlice) as unknown
    if (!Array.isArray(parsed)) return { visibleText, createTasks: [] }
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      if (o.type !== 'create_task') continue
      if (typeof o.title !== 'string' || !o.title.trim()) continue
      const roleName = typeof o.roleName === 'string' ? o.roleName.trim() : ''
      let dueAt: string | undefined
      if (typeof o.dueAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.dueAt)) dueAt = o.dueAt
      createTasks.push({ roleName, title: o.title.trim(), ...(dueAt ? { dueAt } : {}) })
    }
  } catch {
    // ignore malformed JSON
  }

  return { visibleText, createTasks }
}

function norm(s: string) {
  return s.trim().toLowerCase()
}

/**
 * Map a model-supplied role name to a role id. Prefer exact name, then substring matches;
 * if there is exactly one role in the app, use it when the model left roleName empty.
 */
export function resolveRoleIdForTask(
  roles: Role[],
  roleNameFromModel: string,
  preferRoleId?: string | null
): { roleId: string; role: Role } | null {
  if (roles.length === 0) return null

  const q = roleNameFromModel.trim()
  if (!q && roles.length === 1) {
    const r = roles[0]
    return { roleId: r.id, role: r }
  }

  const exact = roles.find((r) => norm(r.name) === norm(q))
  if (exact) return { roleId: exact.id, role: exact }

  const nq = norm(q)
  const contains = roles.filter(
    (r) => nq && (norm(r.name).includes(nq) || nq.includes(norm(r.name)))
  )
  if (contains.length === 1) return { roleId: contains[0].id, role: contains[0] }

  if (contains.length > 1 && preferRoleId) {
    const hit = contains.find((r) => r.id === preferRoleId)
    if (hit) return { roleId: hit.id, role: hit }
  }

  if (contains.length > 1) return null

  if (!q && preferRoleId) {
    const r = roles.find((x) => x.id === preferRoleId)
    if (r) return { roleId: r.id, role: r }
  }

  return null
}
