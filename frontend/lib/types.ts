export type TaskStatus = 'todo' | 'in_progress' | 'done'

export type RoleWorkspaceResource = {
  url: string
  /** Short label; defaults to host when empty. */
  label?: string
}

/** Modular pins in the role in-progress area (notes, links, small files). */
export type RoleWorkspaceBlock =
  | { id: string; type: 'text'; body: string }
  | { id: string; type: 'link'; url: string; label?: string }
  | {
      id: string
      type: 'file'
      name: string
      mimeType?: string
      dataUrl: string
      /** When true, image files show filename + download only (no inline preview). */
      hidePreview?: boolean
    }

export type Role = {
  id: string
  name: string
  color?: string
  icon?: string
  hourlyRate: number
  createdAt: string
  /** @deprecated Migrated onto the focused in-progress task; cleared on next workspace save. */
  workspaceBlocks?: RoleWorkspaceBlock[]
  /** Legacy; merged into task workspace in UI until migrated on save. */
  workspaceNotes?: string
  workspaceResourceLinks?: RoleWorkspaceResource[]
}

/** Set when task was created from today's Boss packet (for ordering / “start here”). */
export type TaskBriefingMeta = {
  date: string
  order: number
}

export type Task = {
  id: string
  roleId: string
  title: string
  status: TaskStatus
  createdAt: string
  updatedAt: string
  completedAt?: string
  briefingMeta?: TaskBriefingMeta
  /** Immediate parent task (same role); omit for top-level tasks. */
  parentTaskId?: string
  /** Order among siblings (same parent + role). */
  sortOrder?: number
  /** Due date YYYY-MM-DD (local calendar day) */
  dueAt?: string
  /** Cumulative seconds spent while status was in_progress */
  totalSecondsSpent?: number
  /** When the current in_progress stint started (ISO); cleared when pausing or completing */
  inProgressStartedAt?: string
  /** Notes / links / files for this task while it’s the in-progress focus (role page). */
  workspaceBlocks?: RoleWorkspaceBlock[]
}

export type Session = {
  id: string
  roleId: string
  startTime: string
  endTime?: string
  durationSeconds?: number
  earnings?: number
  active: boolean
  /**
   * When set, elapsed time only grows while this role’s `/boss/role/:id` tab is open
   * (multi clock-in). Omitted on older active sessions = wall-clock until clock-out.
   */
  billableMsAccrued?: number
}

/** The single outcome you care about most (e.g. gym app daily active users). */
export type NorthStarMetric = {
  /** e.g. "Daily active users" — empty until you set it */
  label: string
  /** null = not entered yet */
  value: number | null
}

/** One workday’s Boss Mode plan: state check → outcomes → active roles → packets → start role → switch rules. */
export type DailyBossRoutine = {
  date: string
  stateCheck: {
    unfinishedFromYesterday: string
    urgent: string
    blocked: string
    energy: '' | 'low' | 'medium' | 'high'
    workingTime: string
  }
  /** 1–3 meaningful results for the day */
  outcomes: string[]
  /** Worker roles “on” today (usually 2–3) */
  activeRoleIds: string[]
  /** Per role: remove friction + concrete packet lines (applied as tasks on commit) */
  rolePackets: Record<string, { frictionNote: string; taskLines: string[] }>
  startingRoleId: string | null
  /** Free-text exit / switch rules per role id */
  switchConditions: Record<string, string>
  /** ISO timestamp when packets were applied; null = still in planning */
  committedAt: string | null
}

export type CalendarRecurrenceFreq = 'daily' | 'weekly' | 'monthly'

export type CalendarRecurrence = {
  freq: CalendarRecurrenceFreq
  /** Repeat every N periods; default 1 */
  interval?: number
  /** Inclusive end date YYYY-MM-DD (local); omit = repeats without an end in the app */
  until?: string
}

export type CalendarEvent = {
  id: string
  title: string
  /** ISO datetime (e.g. from Date.toISOString() or datetime-local parsed) */
  startsAt: string
  endsAt?: string
  location?: string
  notes?: string
  /** When set, the event repeats from its first local start day per rule. */
  recurrence?: CalendarRecurrence
  createdAt: string
}

export type KpiDefinition = {
  id: string
  label: string
  color?: string
  createdAt: string
}

export type KpiEntry = {
  id: string
  kpiId: string
  /** YYYY-MM-DD */
  date: string
  value: number
  createdAt: string
}

/** Aligns with presets in `bossModulePresets.ts` for future plug-in behavior. */
export type BossModuleTemplateKey =
  | 'custom'
  | 'email_triage'
  | 'state_snapshot'
  | 'calendar_scan'
  | 'role_planning_hint'

/** User-built daily dashboard cards (optional templates via templateKey). */
export type BossDashboardModule = {
  id: string
  title: string
  body: string
  templateKey?: BossModuleTemplateKey
  sortOrder: number
}

/** Stable preferences for AI task framing (Boss tab / future assistants). */
export type UserProfile = {
  roles: string[]
  preferredTaskStyle: string
  preferredWarmup: string
  commonBlockers: string[]
}

export type UserGoals = {
  mainGoal: string
  currentPriority: string
  secondaryPriority?: string
}

export type ProjectContext = {
  name: string
  summary: string
  phase: string
  workstreams: string[]
  bottleneck?: string
}

export type WorkingState = {
  inProgress: string[]
  urgent: string[]
  blocked: string[]
  avoiding: string[]
}

/** Single JSON blob per user: profile, goals, projects, live working state. */
export type AIContext = {
  profile: UserProfile
  goals: UserGoals
  projects: ProjectContext[]
  workingState: WorkingState
}

export type AppState = {
  roles: Role[]
  tasks: Task[]
  sessions: Session[]
  activeSessionId: string | null
  totalCurrency: number
  /** Cumulative ms spent in the Boss workspace (`/boss`); coins bank when you leave. */
  bossWindowMsAccrued: number
  northStar: NorthStarMetric
  bossDailyRoutine: DailyBossRoutine | null
  calendarEvents: CalendarEvent[]
  kpiDefinitions: KpiDefinition[]
  kpiEntries: KpiEntry[]
  bossDashboardModules: BossDashboardModule[]
  aiContext: AIContext
  /**
   * When false, prompt the quick AI context onboarding. Omitted in stored JSON = treated as true
   * so existing installs are not blocked.
   */
  aiContextSetupComplete: boolean
}

export const DEFAULT_HOURLY_RATE = 20

export function emptyAIContext(): AIContext {
  return {
    profile: {
      roles: [],
      preferredTaskStyle: '',
      preferredWarmup: '',
      commonBlockers: [],
    },
    goals: { mainGoal: '', currentPriority: '' },
    projects: [],
    workingState: { inProgress: [], urgent: [], blocked: [], avoiding: [] },
  }
}

export function emptyAppState(): AppState {
  return {
    roles: [],
    tasks: [],
    sessions: [],
    activeSessionId: null,
    totalCurrency: 0,
    bossWindowMsAccrued: 0,
    northStar: { label: '', value: null },
    bossDailyRoutine: null,
    calendarEvents: [],
    kpiDefinitions: [],
    kpiEntries: [],
    bossDashboardModules: [],
    aiContext: emptyAIContext(),
    aiContextSetupComplete: false,
  }
}
