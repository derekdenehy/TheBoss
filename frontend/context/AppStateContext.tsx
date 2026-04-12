'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { earningsForElapsedSeconds } from '@/lib/earnings'
import { createId } from '@/lib/ids'
import { finalizeSessionSnapshot, usesRouteBilling } from '@/lib/sessionUtils'
import { emptyDailyBossRoutine, getTodayKey } from '@/lib/dailyBoss'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { fetchBossAppStateJson, upsertBossAppState } from '@/lib/supabase/sync'
import { loadAppState, parseAppStateFromUnknown, saveAppState } from '@/lib/storage'
import {
  removeLinesFromAllWorkingState,
  syncWorkingStateAfterTaskPatch,
} from '@/lib/aiContext'
import { collectDescendantTaskIds, nextTaskSortOrder } from '@/lib/taskTree'
import type {
  AIContext,
  AppState,
  BossDashboardModule,
  CalendarEvent,
  DailyBossRoutine,
  KpiDefinition,
  KpiEntry,
  NorthStarMetric,
  Role,
  Session,
  Task,
  TaskBriefingMeta,
} from '@/lib/types'
import { DEFAULT_HOURLY_RATE, emptyAppState } from '@/lib/types'

type ClockInResult = { ok: true } | { ok: false; reason: 'unknown_role' }

type AppActions = {
  addRole: (input: { name: string; color?: string; hourlyRate?: number }) => boolean
  updateRole: (
    id: string,
    patch: Partial<
      Pick<
        Role,
        | 'name'
        | 'color'
        | 'icon'
        | 'hourlyRate'
        | 'workspaceNotes'
        | 'workspaceResourceLinks'
        | 'workspaceBlocks'
      >
    >
  ) => boolean
  deleteRole: (id: string) => void
  addTask: (
    roleId: string,
    title: string,
    options?: { briefingMeta?: TaskBriefingMeta; parentTaskId?: string; status?: Task['status'] }
  ) => void
  updateTask: (
    id: string,
    patch: Partial<Pick<Task, 'title' | 'status' | 'dueAt' | 'workspaceBlocks'>>
  ) => void
  deleteTask: (id: string) => void
  clockIn: (roleId: string) => ClockInResult
  /** End the active session for this role (each role has at most one active session). */
  clockOut: (roleId: string) => Session | null
  getRoleById: (id: string) => Role | undefined
  getTasksForRole: (roleId: string) => Task[]
  /** All sessions currently clocked in (multiple roles allowed). */
  getActiveSessions: () => Session[]
  /** Active session for this role, if any. */
  getActiveSessionForRole: (roleId: string) => Session | undefined
  /** Live elapsed seconds for this role’s active session. */
  liveElapsedSecondsForRole: (roleId: string) => number
  /** Live earnings for this role’s active session. */
  liveSessionEarningsForRole: (roleId: string) => number
  taskCounts: (roleId: string) => { open: number; done: number }
  tasksCompletedDuringSession: (session: Session) => Task[]
  updateNorthStar: (patch: Partial<NorthStarMetric>) => void
  /** Replace with a fresh empty routine for today’s date. */
  beginBossDayForToday: () => void
  /** Update today’s Boss routine (initializes today’s routine if missing or wrong date). */
  setBossDailyRoutine: (fn: (draft: DailyBossRoutine) => DailyBossRoutine) => void
  /** Create tasks from role packets and mark the day committed. Returns validation error if not ready. */
  commitBossDailyTaskPackets: () => { ok: true } | { ok: false; error: string }
  /** True when today’s routine exists and has been committed. */
  isBossDayCommitted: boolean
  /** Today’s routine if its date matches the device calendar; otherwise null (stale or none). */
  todayBossRoutine: DailyBossRoutine | null
  addCalendarEvent: (input: Omit<CalendarEvent, 'id' | 'createdAt'>) => void
  updateCalendarEvent: (id: string, patch: Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>) => void
  deleteCalendarEvent: (id: string) => void
  addKpiDefinition: (input: { label: string; color?: string }) => void
  updateKpiDefinition: (id: string, patch: Partial<Pick<KpiDefinition, 'label' | 'color'>>) => void
  deleteKpiDefinition: (id: string) => void
  setKpiEntry: (input: { kpiId: string; date: string; value: number }) => void
  deleteKpiEntry: (id: string) => void
  addBossDashboardModule: (input: {
    title: string
    body?: string
    templateKey?: BossDashboardModule['templateKey']
  }) => void
  updateBossDashboardModule: (
    id: string,
    patch: Partial<Pick<BossDashboardModule, 'title' | 'body'>>
  ) => void
  deleteBossDashboardModule: (id: string) => void
  moveBossDashboardModule: (id: string, dir: 'up' | 'down') => void
  /** Keep billing focus in sync with the open Boss role route (`/boss/role/:id`). */
  syncBillingFocusFromPath: (pathname: string | null) => void
  /** Start counting Boss-workspace time (Boss layout mounted, after hydrate). */
  beginBossWindowSession: () => void
  /** Bank Boss-workspace time and coins (Boss layout unmount). */
  endBossWindowSession: () => void
  /** Total seconds in Boss workspace (persisted + current visit). */
  liveBossWindowSeconds: () => number
  /** Coins earned so far this Boss visit (not banked until you leave Boss). */
  liveBossWindowStintEarnings: () => number
  /** `totalCurrency` plus pending coins from the current Boss visit. */
  liveTotalCurrency: () => number
  /** Replace the full AI context blob (profile, goals, projects, working state). */
  setAIContext: (ctx: AIContext) => void
  setAIContextSetupComplete: (complete: boolean) => void
  supabaseConfigured: boolean
  authUser: { email?: string } | null
  signOut: () => Promise<void>
}

const AppStateContext = createContext<(AppState & AppActions & { hydrated: boolean }) | null>(
  null
)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => emptyAppState())
  const [hydrated, setHydrated] = useState(false)
  const [tick, setTick] = useState(0)
  const [bossWindowLayoutOpen, setBossWindowLayoutOpen] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bossWindowSegmentStartedAtRef = useRef<number | null>(null)
  const billingFocusRoleIdRef = useRef<string | null>(null)
  const billingSegmentStartedAtRef = useRef<number | null>(null)
  const cloudUserIdRef = useRef<string | null>(null)
  const [authUser, setAuthUser] = useState<{ email?: string } | null>(null)

  const syncBillingFocusFromPath = useCallback((pathname: string | null) => {
    const m = pathname?.match(/^\/boss\/role\/([^/]+)/)
    const nextFocus = m?.[1] ?? null
    const now = Date.now()
    const prevFocus = billingFocusRoleIdRef.current
    const prevSegment = billingSegmentStartedAtRef.current

    if (prevFocus === nextFocus) {
      if (nextFocus !== null && prevSegment === null) {
        billingSegmentStartedAtRef.current = now
        setTick((t) => t + 1)
      }
      return
    }

    setState((s) => {
      if (prevFocus == null || prevSegment == null) return s
      const delta = Math.max(0, now - prevSegment)
      if (delta === 0) return s
      const touchesBillable = s.sessions.some(
        (se) => se.active && se.roleId === prevFocus && usesRouteBilling(se)
      )
      if (!touchesBillable) return s
      return {
        ...s,
        sessions: s.sessions.map((se) => {
          if (!se.active || se.roleId !== prevFocus || !usesRouteBilling(se)) {
            return se
          }
          return {
            ...se,
            billableMsAccrued: (se.billableMsAccrued ?? 0) + delta,
          }
        }),
      }
    })

    billingFocusRoleIdRef.current = nextFocus
    billingSegmentStartedAtRef.current = nextFocus !== null ? now : null
    setTick((t) => t + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    const subRef: { current: { unsubscribe: () => void } | null } = { current: null }

    const finishLocalOnly = () => {
      setState(loadAppState())
      cloudUserIdRef.current = null
      setAuthUser(null)
      setHydrated(true)
    }

    if (!isSupabaseConfigured()) {
      finishLocalOnly()
      return () => {
        cancelled = true
      }
    }

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      finishLocalOnly()
      return () => {
        cancelled = true
      }
    }

    const applySession = async (user: { id: string; email?: string | null } | null) => {
      if (cancelled) return
      if (!user) {
        cloudUserIdRef.current = null
        setAuthUser(null)
        setState(loadAppState())
        return
      }
      cloudUserIdRef.current = user.id
      setAuthUser({ email: user.email ?? undefined })
      const json = await fetchBossAppStateJson(supabase, user.id)
      if (cancelled) return
      const local = loadAppState()
      if (json !== null) {
        const remote = parseAppStateFromUnknown(json)
        const remoteEmpty =
          remote.roles.length === 0 &&
          remote.tasks.length === 0 &&
          remote.sessions.length === 0
        const localHasData =
          local.roles.length > 0 || local.tasks.length > 0 || local.sessions.length > 0
        if (remoteEmpty && localHasData) {
          setState(local)
          await upsertBossAppState(supabase, user.id, local)
        } else {
          setState(remote)
        }
      } else {
        setState(local)
        await upsertBossAppState(supabase, user.id, local)
      }
    }

    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return

      if (!session?.user) {
        cloudUserIdRef.current = null
        setAuthUser(null)
        setState(loadAppState())
      } else {
        await applySession(session.user)
      }
      if (cancelled) return
      setHydrated(true)

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
        if (cancelled) return
        if (event === 'INITIAL_SESSION') return
        if (event === 'SIGNED_OUT') {
          await applySession(null)
        } else if (event === 'SIGNED_IN' && nextSession?.user) {
          await applySession(nextSession.user)
        }
      })
      subRef.current = subscription
    })()

    return () => {
      cancelled = true
      subRef.current?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveAppState(state)
      const uid = cloudUserIdRef.current
      const supabase = getSupabaseBrowserClient()
      if (uid && supabase) {
        void upsertBossAppState(supabase, uid, state)
      }
    }, 120)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [state, hydrated])

  const hasAnyActiveSession = useMemo(
    () => state.sessions.some((s) => s.active),
    [state.sessions]
  )

  useEffect(() => {
    if (!hasAnyActiveSession && !bossWindowLayoutOpen) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [hasAnyActiveSession, bossWindowLayoutOpen])

  const beginBossWindowSession = useCallback(() => {
    if (bossWindowSegmentStartedAtRef.current != null) return
    bossWindowSegmentStartedAtRef.current = Date.now()
    setBossWindowLayoutOpen(true)
    setTick((t) => t + 1)
  }, [])

  const endBossWindowSession = useCallback(() => {
    const seg = bossWindowSegmentStartedAtRef.current
    bossWindowSegmentStartedAtRef.current = null
    setBossWindowLayoutOpen(false)
    if (seg == null) return
    const now = Date.now()
    const delta = Math.max(0, now - seg)
    setState((s) => ({
      ...s,
      bossWindowMsAccrued: (s.bossWindowMsAccrued ?? 0) + delta,
      totalCurrency:
        s.totalCurrency + earningsForElapsedSeconds(delta / 1000, DEFAULT_HOURLY_RATE),
    }))
    setTick((t) => t + 1)
  }, [])

  const liveBossWindowSeconds = useCallback(() => {
    const acc = state.bossWindowMsAccrued ?? 0
    const seg = bossWindowSegmentStartedAtRef.current
    const now = Date.now()
    const extra = seg != null ? now - seg : 0
    return Math.floor((acc + extra) / 1000)
  }, [state.bossWindowMsAccrued, tick])

  const liveBossWindowStintEarnings = useCallback(() => {
    const seg = bossWindowSegmentStartedAtRef.current
    if (seg == null) return 0
    return earningsForElapsedSeconds((Date.now() - seg) / 1000, DEFAULT_HOURLY_RATE)
  }, [tick])

  const liveTotalCurrency = useCallback(() => {
    const seg = bossWindowSegmentStartedAtRef.current
    let pending = 0
    if (seg != null) {
      pending = earningsForElapsedSeconds((Date.now() - seg) / 1000, DEFAULT_HOURLY_RATE)
    }
    return state.totalCurrency + pending
  }, [state.totalCurrency, tick])

  const getActiveSessions = useCallback(
    () => state.sessions.filter((s) => s.active),
    [state.sessions]
  )

  const getActiveSessionForRole = useCallback(
    (roleId: string) => state.sessions.find((s) => s.active && s.roleId === roleId),
    [state.sessions]
  )

  const liveElapsedSecondsForRole = useCallback(
    (roleId: string) => {
      const s = state.sessions.find((se) => se.active && se.roleId === roleId)
      if (!s) return 0
      const now = Date.now()
      if (!usesRouteBilling(s)) {
        const start = new Date(s.startTime).getTime()
        return Math.max(0, Math.floor((now - start) / 1000))
      }
      const accrued = s.billableMsAccrued ?? 0
      const focus = billingFocusRoleIdRef.current
      const seg = billingSegmentStartedAtRef.current
      if (focus === roleId && seg != null) {
        return Math.max(0, Math.floor((accrued + (now - seg)) / 1000))
      }
      return Math.floor(accrued / 1000)
    },
    [state.sessions, tick]
  )

  const liveSessionEarningsForRole = useCallback(
    (roleId: string) => {
      const role = state.roles.find((r) => r.id === roleId)
      if (!role) return 0
      return earningsForElapsedSeconds(liveElapsedSecondsForRole(roleId), role.hourlyRate)
    },
    [state.roles, liveElapsedSecondsForRole]
  )

  const getRoleById = useCallback(
    (id: string) => state.roles.find((r) => r.id === id),
    [state.roles]
  )

  const getTasksForRole = useCallback(
    (roleId: string) => state.tasks.filter((t) => t.roleId === roleId),
    [state.tasks]
  )

  const taskCounts = useCallback(
    (roleId: string) => {
      const list = state.tasks.filter((t) => t.roleId === roleId)
      const open = list.filter((t) => t.status !== 'done').length
      const done = list.filter((t) => t.status === 'done').length
      return { open, done }
    },
    [state.tasks]
  )

  const addRole = useCallback(
    (input: { name: string; color?: string; hourlyRate?: number }) => {
      const name = input.name.trim()
      if (!name) return false
      const dup = state.roles.some((r) => r.name.trim().toLowerCase() === name.toLowerCase())
      if (dup) return false
      const now = new Date().toISOString()
      const role: Role = {
        id: createId(),
        name,
        color: input.color,
        hourlyRate: input.hourlyRate ?? DEFAULT_HOURLY_RATE,
        createdAt: now,
      }
      setState((s) => ({ ...s, roles: [...s.roles, role] }))
      return true
    },
    [state.roles]
  )

  const updateRole = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<
          Role,
          | 'name'
          | 'color'
          | 'icon'
          | 'hourlyRate'
          | 'workspaceNotes'
          | 'workspaceResourceLinks'
          | 'workspaceBlocks'
        >
      >
    ) => {
      const name = patch.name?.trim()
      if (name !== undefined) {
        if (!name) return false
        const dup = state.roles.some(
          (r) =>
            r.id !== id && r.name.trim().toLowerCase() === name.toLowerCase()
        )
        if (dup) return false
      }
      setState((s) => ({
        ...s,
        roles: s.roles.map((r) =>
          r.id === id ? { ...r, ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) } : r
        ),
      }))
      return true
    },
    [state.roles]
  )

  const deleteRole = useCallback((id: string) => {
    setState((s) => {
      const nextSessions = s.sessions.filter((se) => se.roleId !== id)
      const ptr = s.activeSessionId
      const ptrOk = ptr && nextSessions.some((se) => se.id === ptr && se.active)
      return {
        ...s,
        roles: s.roles.filter((r) => r.id !== id),
        tasks: s.tasks.filter((t) => t.roleId !== id),
        sessions: nextSessions,
        activeSessionId: ptrOk ? ptr : nextSessions.find((se) => se.active)?.id ?? null,
      }
    })
  }, [])

  const addTask = useCallback(
    (
      roleId: string,
      title: string,
      options?: { briefingMeta?: TaskBriefingMeta; parentTaskId?: string; status?: Task['status'] }
    ) => {
      const t = title.trim()
      if (!t) return
      setState((s) => {
        const parentId = options?.parentTaskId
        let parent: Task | undefined
        if (parentId) {
          parent = s.tasks.find((x) => x.id === parentId)
          if (!parent || parent.roleId !== roleId) return s
        }
        const now = new Date().toISOString()
        const sortOrder = nextTaskSortOrder(s.tasks, roleId, parentId)
        const inheritInProgress = parent?.status === 'in_progress'
        const status = options?.status ?? (inheritInProgress ? 'in_progress' : 'todo')
        const inProgressStartedAt = status === 'in_progress' ? now : undefined
        const completedAt = status === 'done' ? now : undefined
        const task: Task = {
          id: createId(),
          roleId,
          title: t,
          status,
          createdAt: now,
          updatedAt: now,
          sortOrder,
          ...(parentId ? { parentTaskId: parentId } : {}),
          ...(options?.briefingMeta ? { briefingMeta: options.briefingMeta } : {}),
          ...(inProgressStartedAt ? { inProgressStartedAt } : {}),
          ...(completedAt ? { completedAt } : {}),
        }
        return { ...s, tasks: [...s.tasks, task] }
      })
    },
    []
  )

  const updateTask = useCallback(
    (
      id: string,
      patch: Partial<Pick<Task, 'title' | 'status' | 'dueAt' | 'workspaceBlocks'>>
    ) => {
      const nowIso = new Date().toISOString()
      const nowMs = Date.now()
      setState((s) => {
        const t = s.tasks.find((x) => x.id === id)
        if (!t) return s

        const nextStatus = patch.status ?? t.status

        let totalSecondsSpent = t.totalSecondsSpent ?? 0
        let inProgressStartedAt = t.inProgressStartedAt

        if (patch.status !== undefined) {
          if (t.status === 'in_progress' && nextStatus !== 'in_progress') {
            if (t.inProgressStartedAt) {
              const start = new Date(t.inProgressStartedAt).getTime()
              if (!Number.isNaN(start)) {
                totalSecondsSpent += Math.max(0, Math.floor((nowMs - start) / 1000))
              }
            }
            inProgressStartedAt = undefined
          }
          if (nextStatus === 'in_progress' && t.status !== 'in_progress') {
            inProgressStartedAt = nowIso
          }
        }

        let completedAt = t.completedAt
        if (patch.status !== undefined) {
          if (nextStatus === 'done') completedAt = nowIso
          else completedAt = undefined
        }

        let dueAt = t.dueAt
        if (patch.dueAt !== undefined) {
          const d = patch.dueAt.trim()
          dueAt = d === '' ? undefined : d
        }

        let title = t.title
        if (patch.title !== undefined) title = patch.title

        const updated: Task = {
          ...t,
          title,
          status: nextStatus,
          updatedAt: nowIso,
          completedAt,
          dueAt,
          totalSecondsSpent,
          inProgressStartedAt,
        }

        if (patch.workspaceBlocks !== undefined) {
          if (patch.workspaceBlocks.length > 0) {
            updated.workspaceBlocks = patch.workspaceBlocks
          } else {
            delete updated.workspaceBlocks
          }
        }

        const nextWorkingState = syncWorkingStateAfterTaskPatch(
          s.aiContext.workingState,
          { title: t.title, status: t.status },
          { title: updated.title, status: updated.status }
        )

        return {
          ...s,
          tasks: s.tasks.map((x) => (x.id === id ? updated : x)),
          aiContext: { ...s.aiContext, workingState: nextWorkingState },
        }
      })
    },
    []
  )

  const deleteTask = useCallback((id: string) => {
    setState((s) => {
      const removeIds = new Set(collectDescendantTaskIds(s.tasks, id))
      const removedTitles = s.tasks
        .filter((t) => removeIds.has(t.id))
        .map((t) => t.title.trim())
        .filter(Boolean)
      const workingState =
        removedTitles.length > 0
          ? removeLinesFromAllWorkingState(s.aiContext.workingState, removedTitles)
          : s.aiContext.workingState
      return {
        ...s,
        tasks: s.tasks.filter((t) => !removeIds.has(t.id)),
        aiContext: { ...s.aiContext, workingState },
      }
    })
  }, [])

  const finalizeSession = useCallback((session: Session): Session => {
    let endedOut: Session | undefined
    const endMs = Date.now()
    const billingCtx = {
      focusRoleId: billingFocusRoleIdRef.current,
      segmentStartedAt: billingSegmentStartedAtRef.current,
    }
    setState((s) => {
      const ended = finalizeSessionSnapshot(session, s.roles, endMs, billingCtx)
      endedOut = ended
      const newSessions = s.sessions.map((se) => (se.id === session.id ? ended : se))
      let nextPointer = s.activeSessionId
      if (nextPointer === session.id) {
        nextPointer = newSessions.find((se) => se.active)?.id ?? null
      }
      return {
        ...s,
        sessions: newSessions,
        activeSessionId: nextPointer,
        totalCurrency: s.totalCurrency + (ended.earnings ?? 0),
      }
    })
    return endedOut!
  }, [])

  const clockIn = useCallback(
    (roleId: string): ClockInResult => {
      const role = state.roles.find((r) => r.id === roleId)
      if (!role) return { ok: false, reason: 'unknown_role' }

      const existingForRole = state.sessions.find((s) => s.active && s.roleId === roleId)
      if (existingForRole) {
        if (!usesRouteBilling(existingForRole)) {
          const nowMs = Date.now()
          const start = new Date(existingForRole.startTime).getTime()
          const wallMs = Number.isNaN(start) ? 0 : Math.max(0, nowMs - start)
          setState((s) => ({
            ...s,
            sessions: s.sessions.map((se) =>
              se.id === existingForRole.id ? { ...se, billableMsAccrued: wallMs } : se
            ),
          }))
          if (billingFocusRoleIdRef.current === roleId) {
            billingSegmentStartedAtRef.current = Date.now()
          }
        }
        return { ok: true }
      }

      const session: Session = {
        id: createId(),
        roleId,
        startTime: new Date().toISOString(),
        active: true,
        billableMsAccrued: 0,
      }
      setState((s) => ({
        ...s,
        sessions: [...s.sessions, session],
        activeSessionId: session.id,
      }))
      if (billingFocusRoleIdRef.current === roleId) {
        billingSegmentStartedAtRef.current = Date.now()
      }
      return { ok: true }
    },
    [state.roles, state.sessions]
  )

  const clockOut = useCallback(
    (roleId: string): Session | null => {
      const current = state.sessions.find((s) => s.active && s.roleId === roleId)
      if (!current) return null
      return finalizeSession(current)
    },
    [state.sessions, finalizeSession]
  )

  const updateNorthStar = useCallback((patch: Partial<NorthStarMetric>) => {
    setState((s) => ({
      ...s,
      northStar: {
        label: patch.label !== undefined ? patch.label.trim() : s.northStar.label,
        value: patch.value !== undefined ? patch.value : s.northStar.value,
      },
    }))
  }, [])

  const todayBossRoutine = useMemo(() => {
    const r = state.bossDailyRoutine
    const today = getTodayKey()
    if (!r || r.date !== today) return null
    return r
  }, [state.bossDailyRoutine])

  const isBossDayCommitted = !!todayBossRoutine?.committedAt

  const beginBossDayForToday = useCallback(() => {
    setState((s) => ({ ...s, bossDailyRoutine: emptyDailyBossRoutine(getTodayKey()) }))
  }, [])

  const setBossDailyRoutine = useCallback(
    (fn: (draft: DailyBossRoutine) => DailyBossRoutine) => {
      setState((s) => {
        const today = getTodayKey()
        const base =
          s.bossDailyRoutine?.date === today ? s.bossDailyRoutine : emptyDailyBossRoutine(today)
        return { ...s, bossDailyRoutine: fn(base) }
      })
    },
    []
  )

  const addCalendarEvent = useCallback((input: Omit<CalendarEvent, 'id' | 'createdAt'>) => {
    const now = new Date().toISOString()
    const ev: CalendarEvent = { ...input, id: createId(), createdAt: now }
    setState((s) => ({ ...s, calendarEvents: [...s.calendarEvents, ev] }))
  }, [])

  const updateCalendarEvent = useCallback(
    (id: string, patch: Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>) => {
      setState((s) => ({
        ...s,
        calendarEvents: s.calendarEvents.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }))
    },
    []
  )

  const deleteCalendarEvent = useCallback((id: string) => {
    setState((s) => ({ ...s, calendarEvents: s.calendarEvents.filter((e) => e.id !== id) }))
  }, [])

  const addKpiDefinition = useCallback((input: { label: string; color?: string }) => {
    const label = input.label.trim()
    if (!label) return
    const now = new Date().toISOString()
    const k: KpiDefinition = {
      id: createId(),
      label,
      color: input.color,
      createdAt: now,
    }
    setState((s) => ({ ...s, kpiDefinitions: [...s.kpiDefinitions, k] }))
  }, [])

  const updateKpiDefinition = useCallback(
    (id: string, patch: Partial<Pick<KpiDefinition, 'label' | 'color'>>) => {
      setState((s) => ({
        ...s,
        kpiDefinitions: s.kpiDefinitions.map((k) =>
          k.id === id
            ? {
                ...k,
                ...patch,
                ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
              }
            : k
        ),
      }))
    },
    []
  )

  const deleteKpiDefinition = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      kpiDefinitions: s.kpiDefinitions.filter((k) => k.id !== id),
      kpiEntries: s.kpiEntries.filter((e) => e.kpiId !== id),
    }))
  }, [])

  const setKpiEntry = useCallback((input: { kpiId: string; date: string; value: number }) => {
    const now = new Date().toISOString()
    setState((s) => {
      const existing = s.kpiEntries.find(
        (e) => e.kpiId === input.kpiId && e.date === input.date
      )
      if (existing) {
        return {
          ...s,
          kpiEntries: s.kpiEntries.map((e) =>
            e.id === existing.id ? { ...e, value: input.value, createdAt: now } : e
          ),
        }
      }
      const entry: KpiEntry = {
        id: createId(),
        kpiId: input.kpiId,
        date: input.date,
        value: input.value,
        createdAt: now,
      }
      return { ...s, kpiEntries: [...s.kpiEntries, entry] }
    })
  }, [])

  const deleteKpiEntry = useCallback((id: string) => {
    setState((s) => ({ ...s, kpiEntries: s.kpiEntries.filter((e) => e.id !== id) }))
  }, [])

  const addBossDashboardModule = useCallback(
    (input: {
      title: string
      body?: string
      templateKey?: BossDashboardModule['templateKey']
    }) => {
      const title = input.title.trim()
      if (!title) return
      setState((s) => {
        const max = s.bossDashboardModules.reduce((acc, m) => Math.max(acc, m.sortOrder), -1)
        const mod: BossDashboardModule = {
          id: createId(),
          title,
          body: input.body ?? '',
          templateKey: input.templateKey,
          sortOrder: max + 1,
        }
        return { ...s, bossDashboardModules: [...s.bossDashboardModules, mod] }
      })
    },
    []
  )

  const updateBossDashboardModule = useCallback(
    (id: string, patch: Partial<Pick<BossDashboardModule, 'title' | 'body'>>) => {
      setState((s) => ({
        ...s,
        bossDashboardModules: s.bossDashboardModules.map((m) =>
          m.id === id
            ? {
                ...m,
                ...patch,
                ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
              }
            : m
        ),
      }))
    },
    []
  )

  const deleteBossDashboardModule = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      bossDashboardModules: s.bossDashboardModules.filter((m) => m.id !== id),
    }))
  }, [])

  const moveBossDashboardModule = useCallback((id: string, dir: 'up' | 'down') => {
    setState((s) => {
      const sorted = [...s.bossDashboardModules].sort((a, b) => a.sortOrder - b.sortOrder)
      const i = sorted.findIndex((m) => m.id === id)
      if (i < 0) return s
      const j = dir === 'up' ? i - 1 : i + 1
      if (j < 0 || j >= sorted.length) return s
      const a = sorted[i]
      const b = sorted[j]
      const soA = a.sortOrder
      const soB = b.sortOrder
      return {
        ...s,
        bossDashboardModules: s.bossDashboardModules.map((m) => {
          if (m.id === a.id) return { ...m, sortOrder: soB }
          if (m.id === b.id) return { ...m, sortOrder: soA }
          return m
        }),
      }
    })
  }, [])

  const commitBossDailyTaskPackets = useCallback((): { ok: true } | { ok: false; error: string } => {
    let out: { ok: true } | { ok: false; error: string } = {
      ok: false,
      error: 'Could not commit.',
    }
    setState((s) => {
      const today = getTodayKey()
      const r = s.bossDailyRoutine
      if (!r || r.date !== today) {
        out = { ok: false, error: 'No plan for today. Start Boss Mode first.' }
        return s
      }
      if (r.committedAt) {
        out = { ok: false, error: 'Today’s plan is already committed.' }
        return s
      }

      const outcomes = r.outcomes.map((o) => o.trim()).filter(Boolean)
      if (outcomes.length < 1 || outcomes.length > 3) {
        out = { ok: false, error: 'Write 1–3 daily outcomes (meaningful results, not a long list).' }
        return s
      }

      if (r.activeRoleIds.length < 1 || r.activeRoleIds.length > 3) {
        out = { ok: false, error: 'Pick 1–3 active roles for today.' }
        return s
      }

      const invalidRole = r.activeRoleIds.some((id) => !s.roles.some((ro) => ro.id === id))
      if (invalidRole) {
        out = { ok: false, error: 'An active role no longer exists. Re-select your roles.' }
        return s
      }

      if (!r.startingRoleId || !r.activeRoleIds.includes(r.startingRoleId)) {
        out = { ok: false, error: 'Choose which role to start with today.' }
        return s
      }

      for (const rid of r.activeRoleIds) {
        const pack = r.rolePackets[rid] ?? { frictionNote: '', taskLines: [] }
        const lines = pack.taskLines.map((l) => l.trim()).filter(Boolean)
        if (lines.length < 1) {
          const rn = s.roles.find((x) => x.id === rid)?.name ?? 'A role'
          out = {
            ok: false,
            error: `Add at least one concrete task for ${rn} (specific steps, not vague work).`,
          }
          return s
        }
      }

      const now = new Date().toISOString()
      const newTasks: Task[] = []
      for (const rid of r.activeRoleIds) {
        const pack = r.rolePackets[rid] ?? { frictionNote: '', taskLines: [] }
        const lines = pack.taskLines.map((l) => l.trim()).filter(Boolean)
        let order = 0
        for (const title of lines) {
          newTasks.push({
            id: createId(),
            roleId: rid,
            title,
            status: 'todo',
            createdAt: now,
            updatedAt: now,
            briefingMeta: { date: today, order },
          })
          order += 1
        }
      }

      out = { ok: true }
      return {
        ...s,
        tasks: [...s.tasks, ...newTasks],
        bossDailyRoutine: {
          ...r,
          outcomes: outcomes.slice(0, 3),
          committedAt: now,
        },
      }
    })
    return out
  }, [])

  const tasksCompletedDuringSession = useCallback(
    (session: Session) => {
      const start = new Date(session.startTime).getTime()
      const end = session.endTime ? new Date(session.endTime).getTime() : Date.now()
      return state.tasks.filter((t) => {
        if (t.roleId !== session.roleId || t.status !== 'done' || !t.completedAt) return false
        const c = new Date(t.completedAt).getTime()
        return c >= start && c <= end
      })
    },
    [state.tasks]
  )

  const setAIContext = useCallback((ctx: AIContext) => {
    setState((s) => ({ ...s, aiContext: ctx }))
  }, [])

  const setAIContextSetupComplete = useCallback((complete: boolean) => {
    setState((s) => ({ ...s, aiContextSetupComplete: complete }))
  }, [])

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    if (supabase) await supabase.auth.signOut()
    else {
      cloudUserIdRef.current = null
      setAuthUser(null)
      setState(loadAppState())
    }
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      hydrated,
      addRole,
      updateRole,
      deleteRole,
      addTask,
      updateTask,
      deleteTask,
      clockIn,
      clockOut,
      getRoleById,
      getTasksForRole,
      getActiveSessions,
      getActiveSessionForRole,
      liveElapsedSecondsForRole,
      liveSessionEarningsForRole,
      taskCounts,
      tasksCompletedDuringSession,
      updateNorthStar,
      beginBossDayForToday,
      setBossDailyRoutine,
      commitBossDailyTaskPackets,
      isBossDayCommitted,
      todayBossRoutine,
      addCalendarEvent,
      updateCalendarEvent,
      deleteCalendarEvent,
      addKpiDefinition,
      updateKpiDefinition,
      deleteKpiDefinition,
      setKpiEntry,
      deleteKpiEntry,
      addBossDashboardModule,
      updateBossDashboardModule,
      deleteBossDashboardModule,
      moveBossDashboardModule,
      syncBillingFocusFromPath,
      beginBossWindowSession,
      endBossWindowSession,
      liveBossWindowSeconds,
      liveBossWindowStintEarnings,
      liveTotalCurrency,
      setAIContext,
      setAIContextSetupComplete,
      supabaseConfigured: isSupabaseConfigured(),
      authUser,
      signOut,
    }),
    [
      state,
      hydrated,
      authUser,
      addRole,
      updateRole,
      deleteRole,
      addTask,
      updateTask,
      deleteTask,
      setAIContext,
      setAIContextSetupComplete,
      clockIn,
      clockOut,
      getRoleById,
      getTasksForRole,
      getActiveSessions,
      getActiveSessionForRole,
      liveElapsedSecondsForRole,
      liveSessionEarningsForRole,
      taskCounts,
      tasksCompletedDuringSession,
      updateNorthStar,
      beginBossDayForToday,
      setBossDailyRoutine,
      commitBossDailyTaskPackets,
      isBossDayCommitted,
      todayBossRoutine,
      addCalendarEvent,
      updateCalendarEvent,
      deleteCalendarEvent,
      addKpiDefinition,
      updateKpiDefinition,
      deleteKpiDefinition,
      setKpiEntry,
      deleteKpiEntry,
      addBossDashboardModule,
      updateBossDashboardModule,
      deleteBossDashboardModule,
      moveBossDashboardModule,
      syncBillingFocusFromPath,
      beginBossWindowSession,
      endBossWindowSession,
      liveBossWindowSeconds,
      liveBossWindowStintEarnings,
      liveTotalCurrency,
      setAIContext,
      setAIContextSetupComplete,
      signOut,
    ]
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}
