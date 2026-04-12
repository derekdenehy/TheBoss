import type {
  AIContext,
  AppState,
  BossDashboardModule,
  BossModuleTemplateKey,
  CalendarEvent,
  DailyBossRoutine,
  KpiDefinition,
  KpiEntry,
  NorthStarMetric,
  ProjectContext,
  Session,
  RoleWorkspaceBlock,
  Task,
  UserGoals,
  UserProfile,
  WorkingState,
} from './types'
import { emptyAIContext, emptyAppState } from './types'

const TEMPLATE_KEYS = new Set<BossModuleTemplateKey>([
  'custom',
  'email_triage',
  'state_snapshot',
  'calendar_scan',
  'role_planning_hint',
])

const STORAGE_KEY = 'theboss-app-v1'

function normalizeNorthStar(raw: unknown): NorthStarMetric {
  if (!raw || typeof raw !== 'object') return { label: '', value: null }
  const o = raw as Record<string, unknown>
  const label = typeof o.label === 'string' ? o.label : ''
  const v = o.value
  const value =
    typeof v === 'number' && !Number.isNaN(v)
      ? v
      : v === null || v === undefined
        ? null
        : null
  return { label, value }
}

function normalizeDailyRoutine(raw: unknown): DailyBossRoutine | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as DailyBossRoutine
  if (typeof r.date !== 'string') return null
  const sc = r.stateCheck && typeof r.stateCheck === 'object' ? r.stateCheck : {}
  const energyRaw = (sc as { energy?: string }).energy
  const energy =
    energyRaw === 'low' || energyRaw === 'medium' || energyRaw === 'high' ? energyRaw : ''
  return {
    date: r.date,
    stateCheck: {
      unfinishedFromYesterday: String((sc as { unfinishedFromYesterday?: string }).unfinishedFromYesterday ?? ''),
      urgent: String((sc as { urgent?: string }).urgent ?? ''),
      blocked: String((sc as { blocked?: string }).blocked ?? ''),
      energy,
      workingTime: String((sc as { workingTime?: string }).workingTime ?? ''),
    },
    outcomes: Array.isArray(r.outcomes) ? r.outcomes.filter((x) => typeof x === 'string') : [],
    activeRoleIds: Array.isArray(r.activeRoleIds) ? r.activeRoleIds.filter((x) => typeof x === 'string') : [],
    rolePackets: (() => {
      const raw = r.rolePackets
      if (!raw || typeof raw !== 'object') return {}
      const out: DailyBossRoutine['rolePackets'] = {}
      for (const [k, v] of Object.entries(raw)) {
        if (!v || typeof v !== 'object') continue
        const o = v as { frictionNote?: string; taskLines?: unknown }
        out[k] = {
          frictionNote: String(o.frictionNote ?? ''),
          taskLines: Array.isArray(o.taskLines)
            ? o.taskLines.filter((x): x is string => typeof x === 'string')
            : [],
        }
      }
      return out
    })(),
    startingRoleId: typeof r.startingRoleId === 'string' || r.startingRoleId === null ? r.startingRoleId : null,
    switchConditions:
      r.switchConditions && typeof r.switchConditions === 'object'
        ? (r.switchConditions as Record<string, string>)
        : {},
    committedAt: typeof r.committedAt === 'string' || r.committedAt === null ? r.committedAt : null,
  }
}

function normalizeWorkspaceBlocks(raw: unknown): RoleWorkspaceBlock[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: RoleWorkspaceBlock[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    if (!id) continue
    const type = o.type
    if (type === 'text' && typeof o.body === 'string') {
      out.push({ id, type: 'text', body: o.body })
      continue
    }
    if (type === 'link' && typeof o.url === 'string') {
      out.push({
        id,
        type: 'link',
        url: o.url,
        ...(typeof o.label === 'string' && o.label.trim() ? { label: o.label.trim() } : {}),
      })
      continue
    }
    if (type === 'file' && typeof o.dataUrl === 'string' && typeof o.name === 'string') {
      out.push({
        id,
        type: 'file',
        name: o.name,
        dataUrl: o.dataUrl,
        ...(typeof o.mimeType === 'string' ? { mimeType: o.mimeType } : {}),
        ...(o.hidePreview === true ? { hidePreview: true } : {}),
      })
    }
  }
  return out.length > 0 ? out : undefined
}

function normalizeTask(raw: unknown): Task | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Task
  if (typeof t.id !== 'string' || typeof t.roleId !== 'string') return null
  const title = typeof t.title === 'string' ? t.title : ''
  const status =
    t.status === 'in_progress' || t.status === 'done' ? t.status : 'todo'
  const dueRaw = t.dueAt
  const dueAt =
    typeof dueRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : undefined
  const totalRaw = (t as Task).totalSecondsSpent
  const totalSecondsSpent =
    typeof totalRaw === 'number' && !Number.isNaN(totalRaw)
      ? Math.max(0, Math.floor(totalRaw))
      : undefined
  let inProgressStartedAt =
    typeof (t as Task).inProgressStartedAt === 'string'
      ? (t as Task).inProgressStartedAt
      : undefined
  if (status !== 'in_progress') inProgressStartedAt = undefined

  const parentRaw = (t as Task).parentTaskId
  const parentTaskId =
    typeof parentRaw === 'string' && parentRaw.trim() !== '' ? parentRaw : undefined
  const sortRaw = (t as Task).sortOrder
  const sortOrder =
    typeof sortRaw === 'number' && !Number.isNaN(sortRaw) ? Math.floor(sortRaw) : undefined

  const workspaceBlocks = normalizeWorkspaceBlocks((t as Task).workspaceBlocks)

  return {
    id: t.id,
    roleId: t.roleId,
    title,
    status,
    createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
    updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : new Date().toISOString(),
    completedAt: typeof t.completedAt === 'string' ? t.completedAt : undefined,
    ...(parentTaskId ? { parentTaskId } : {}),
    ...(sortOrder !== undefined ? { sortOrder } : {}),
    ...(workspaceBlocks ? { workspaceBlocks } : {}),
    briefingMeta:
      t.briefingMeta &&
      typeof t.briefingMeta === 'object' &&
      typeof (t.briefingMeta as { date?: string }).date === 'string' &&
      typeof (t.briefingMeta as { order?: number }).order === 'number'
        ? {
            date: (t.briefingMeta as { date: string }).date,
            order: (t.briefingMeta as { order: number }).order,
          }
        : undefined,
    ...(dueAt ? { dueAt } : {}),
    ...(totalSecondsSpent !== undefined ? { totalSecondsSpent } : {}),
    ...(inProgressStartedAt ? { inProgressStartedAt } : {}),
  }
}

function normalizeCalendarEvent(raw: unknown): CalendarEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as CalendarEvent
  if (typeof e.id !== 'string' || typeof e.title !== 'string' || typeof e.startsAt !== 'string')
    return null
  return {
    id: e.id,
    title: e.title,
    startsAt: e.startsAt,
    endsAt: typeof e.endsAt === 'string' ? e.endsAt : undefined,
    location: typeof e.location === 'string' ? e.location : undefined,
    notes: typeof e.notes === 'string' ? e.notes : undefined,
    createdAt: typeof e.createdAt === 'string' ? e.createdAt : new Date().toISOString(),
  }
}

function normalizeKpiDefinition(raw: unknown): KpiDefinition | null {
  if (!raw || typeof raw !== 'object') return null
  const k = raw as KpiDefinition
  if (typeof k.id !== 'string' || typeof k.label !== 'string') return null
  return {
    id: k.id,
    label: k.label,
    color: typeof k.color === 'string' ? k.color : undefined,
    createdAt: typeof k.createdAt === 'string' ? k.createdAt : new Date().toISOString(),
  }
}

function normalizeKpiEntry(raw: unknown): KpiEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as KpiEntry
  if (typeof e.id !== 'string' || typeof e.kpiId !== 'string' || typeof e.date !== 'string')
    return null
  const value = typeof e.value === 'number' && !Number.isNaN(e.value) ? e.value : null
  if (value === null) return null
  return {
    id: e.id,
    kpiId: e.kpiId,
    date: e.date,
    value,
    createdAt: typeof e.createdAt === 'string' ? e.createdAt : new Date().toISOString(),
  }
}

function normalizeBossDashboardModule(raw: unknown): BossDashboardModule | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as BossDashboardModule
  if (typeof m.id !== 'string' || typeof m.title !== 'string') return null
  const tk = m.templateKey
  const templateKey =
    typeof tk === 'string' && TEMPLATE_KEYS.has(tk as BossModuleTemplateKey)
      ? (tk as BossModuleTemplateKey)
      : undefined
  return {
    id: m.id,
    title: m.title,
    body: typeof m.body === 'string' ? m.body : '',
    templateKey,
    sortOrder: typeof m.sortOrder === 'number' && !Number.isNaN(m.sortOrder) ? m.sortOrder : 0,
  }
}

const WORKING_LIST_CAP = 40

function normalizeStringList(raw: unknown, cap: number): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const x of raw) {
    if (typeof x !== 'string') continue
    const t = x.trim()
    if (!t) continue
    if (!out.includes(t)) out.push(t)
    if (out.length >= cap) break
  }
  return out
}

function normalizeUserProfile(raw: unknown): UserProfile {
  if (!raw || typeof raw !== 'object') {
    return emptyAIContext().profile
  }
  const p = raw as Record<string, unknown>
  const roles = normalizeStringList(p.roles, WORKING_LIST_CAP)
  return {
    roles,
    preferredTaskStyle:
      typeof p.preferredTaskStyle === 'string' ? p.preferredTaskStyle.trim() : '',
    preferredWarmup: typeof p.preferredWarmup === 'string' ? p.preferredWarmup.trim() : '',
    commonBlockers: normalizeStringList(p.commonBlockers, WORKING_LIST_CAP),
  }
}

function normalizeUserGoals(raw: unknown): UserGoals {
  if (!raw || typeof raw !== 'object') {
    return emptyAIContext().goals
  }
  const g = raw as Record<string, unknown>
  const sec = g.secondaryPriority
  const secondary =
    typeof sec === 'string' && sec.trim() !== '' ? sec.trim() : undefined
  return {
    mainGoal: typeof g.mainGoal === 'string' ? g.mainGoal.trim() : '',
    currentPriority: typeof g.currentPriority === 'string' ? g.currentPriority.trim() : '',
    ...(secondary ? { secondaryPriority: secondary } : {}),
  }
}

function normalizeProjectContext(raw: unknown): ProjectContext | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  if (!name) return null
  const bottleneck = o.bottleneck
  return {
    name,
    summary: typeof o.summary === 'string' ? o.summary.trim() : '',
    phase: typeof o.phase === 'string' ? o.phase.trim() : '',
    workstreams: normalizeStringList(o.workstreams, 24),
    ...(typeof bottleneck === 'string' && bottleneck.trim() !== ''
      ? { bottleneck: bottleneck.trim() }
      : {}),
  }
}

function normalizeWorkingState(raw: unknown): WorkingState {
  if (!raw || typeof raw !== 'object') {
    return emptyAIContext().workingState
  }
  const w = raw as Record<string, unknown>
  return {
    inProgress: normalizeStringList(w.inProgress, WORKING_LIST_CAP),
    urgent: normalizeStringList(w.urgent, WORKING_LIST_CAP),
    blocked: normalizeStringList(w.blocked, WORKING_LIST_CAP),
    avoiding: normalizeStringList(w.avoiding, WORKING_LIST_CAP),
  }
}

function normalizeAIContext(raw: unknown): AIContext {
  if (!raw || typeof raw !== 'object') {
    return emptyAIContext()
  }
  const c = raw as Record<string, unknown>
  const projectsRaw = c.projects
  const projects = Array.isArray(projectsRaw)
    ? projectsRaw.map(normalizeProjectContext).filter((p): p is ProjectContext => p !== null)
    : []
  return {
    profile: normalizeUserProfile(c.profile),
    goals: normalizeUserGoals(c.goals),
    projects,
    workingState: normalizeWorkingState(c.workingState),
  }
}

/** Backfill route billing for active sessions saved before `billableMsAccrued` existed. */
function migrateSessionsBilling(raw: unknown[], nowMs: number): Session[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (!item || typeof item !== 'object') return item as Session
    const s = item as Session
    if (!s.active || typeof s.billableMsAccrued === 'number') return s
    const start = new Date(s.startTime).getTime()
    const wallMs = Number.isNaN(start) ? 0 : Math.max(0, nowMs - start)
    return { ...s, billableMsAccrued: wallMs }
  })
}

/** Parse app state from localStorage JSON or Supabase `state` jsonb. */
export function parseAppStateFromUnknown(parsed: unknown): AppState {
  return normalizeState(parsed)
}

function normalizeState(parsed: unknown): AppState {
  if (!parsed || typeof parsed !== 'object') return emptyAppState()
  const p = parsed as AppState
  const nowMs = Date.now()
  const tasksRaw = Array.isArray(p.tasks) ? p.tasks : []
  const tasks = tasksRaw
    .map(normalizeTask)
    .filter((t): t is Task => t !== null)

  const eventsRaw = (p as AppState).calendarEvents
  const calendarEvents = Array.isArray(eventsRaw)
    ? eventsRaw.map(normalizeCalendarEvent).filter((e): e is CalendarEvent => e !== null)
    : []

  const kpiDefRaw = (p as AppState).kpiDefinitions
  const kpiDefinitions = Array.isArray(kpiDefRaw)
    ? kpiDefRaw.map(normalizeKpiDefinition).filter((k): k is KpiDefinition => k !== null)
    : []

  const kpiEntRaw = (p as AppState).kpiEntries
  const kpiEntries = Array.isArray(kpiEntRaw)
    ? kpiEntRaw.map(normalizeKpiEntry).filter((e): e is KpiEntry => e !== null)
    : []

  const modRaw = (p as AppState).bossDashboardModules
  const bossDashboardModules = Array.isArray(modRaw)
    ? modRaw
        .map(normalizeBossDashboardModule)
        .filter((m): m is BossDashboardModule => m !== null)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    : []

  const base = p as AppState
  const aiContextSetupComplete =
    typeof base.aiContextSetupComplete === 'boolean' ? base.aiContextSetupComplete : true

  return {
    roles: Array.isArray(p.roles) ? p.roles : [],
    tasks,
    sessions: migrateSessionsBilling(Array.isArray(p.sessions) ? p.sessions : [], nowMs),
    activeSessionId:
      typeof p.activeSessionId === 'string' || p.activeSessionId === null
        ? p.activeSessionId
        : null,
    totalCurrency:
      typeof p.totalCurrency === 'number' && !Number.isNaN(p.totalCurrency) ? p.totalCurrency : 0,
    bossWindowMsAccrued:
      typeof (p as AppState).bossWindowMsAccrued === 'number' &&
      !Number.isNaN((p as AppState).bossWindowMsAccrued)
        ? Math.max(0, (p as AppState).bossWindowMsAccrued)
        : 0,
    northStar: normalizeNorthStar((p as AppState).northStar),
    bossDailyRoutine: normalizeDailyRoutine((p as AppState).bossDailyRoutine),
    calendarEvents,
    kpiDefinitions,
    kpiEntries,
    bossDashboardModules,
    aiContext: normalizeAIContext(base.aiContext),
    aiContextSetupComplete,
  }
}

export function loadAppState(): AppState {
  if (typeof window === 'undefined') return emptyAppState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const base = raw ? parseAppStateFromUnknown(JSON.parse(raw)) : emptyAppState()
    return base
  } catch {
    return emptyAppState()
  }
}

export function saveAppState(state: AppState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore quota / private mode
  }
}
