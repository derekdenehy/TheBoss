import type { Task, TaskStatus } from '@/lib/types'

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

export type StatusColumnRow = {
  task: Task
  depth: number
  /** Parent exists but lives in another status column */
  subRowHint?: string
}

/** DFS order within one status column; supports arbitrary nesting. */
export function orderTasksForStatusColumn(allTasks: Task[], status: TaskStatus): StatusColumnRow[] {
  const inCol = allTasks.filter((t) => t.status === status)
  const colIds = new Set(inCol.map((t) => t.id))
  const byId = new Map(allTasks.map((t) => [t.id, t]))

  const roots = inCol.filter((t) => {
    if (!t.parentTaskId) return true
    return !colIds.has(t.parentTaskId)
  })

  const sortSiblings = (a: Task, b: Task) =>
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()

  roots.sort(sortSiblings)

  const childrenInCol = (pid: string) =>
    inCol.filter((t) => t.parentTaskId === pid).sort(sortSiblings)

  const out: StatusColumnRow[] = []

  const dfs = (t: Task, depth: number) => {
    let subRowHint: string | undefined
    if (t.parentTaskId && !colIds.has(t.parentTaskId)) {
      const p = byId.get(t.parentTaskId)
      if (p) {
        subRowHint = `Under “${p.title}” (${STATUS_LABEL[p.status]})`
      }
    }
    out.push({ task: t, depth, subRowHint })
    for (const c of childrenInCol(t.id)) {
      dfs(c, depth + 1)
    }
  }

  for (const r of roots) {
    dfs(r, 0)
  }
  return out
}

/** All ids in the subtree rooted at `rootId` (including `rootId`). */
export function collectDescendantTaskIds(tasks: Task[], rootId: string): string[] {
  const byParent = new Map<string, Task[]>()
  for (const t of tasks) {
    if (!t.parentTaskId) continue
    const list = byParent.get(t.parentTaskId) ?? []
    list.push(t)
    byParent.set(t.parentTaskId, list)
  }
  const out: string[] = []
  const walk = (id: string) => {
    out.push(id)
    for (const k of byParent.get(id) ?? []) {
      walk(k.id)
    }
  }
  walk(rootId)
  return out
}

export function nextTaskSortOrder(
  tasks: Task[],
  roleId: string,
  parentTaskId: string | undefined
): number {
  const siblings = tasks.filter((t) => {
    if (t.roleId !== roleId) return false
    if (parentTaskId) return t.parentTaskId === parentTaskId
    return !t.parentTaskId
  })
  return siblings.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), 0) + 1
}

/** Number of ancestors (0 = root). */
export function taskDepth(tasks: Task[], task: Task): number {
  let d = 0
  let cur: Task | undefined = task
  const seen = new Set<string>()
  while (cur?.parentTaskId) {
    if (seen.has(cur.id)) break
    seen.add(cur.id)
    const parentId: string = cur.parentTaskId
    cur = tasks.find((x) => x.id === parentId)
    if (cur) d += 1
    else break
  }
  return d
}
