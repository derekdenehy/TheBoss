# Refactor Brief: Role-Based Task / Clock-In MVP

## Goal

Refactor the existing website into a lightweight **role-based productivity app** designed around one core loop:

1. User defines a small set of roles (for example: CEO, Engineer, Marketing, Outreach)
2. User creates small tasks under each role
3. User **clocks in** to one role at a time
4. While clocked in, the UI isolates that role and its tasks
5. Time spent while clocked in earns in-app currency at an hourly rate
6. User marks tasks done, gets credit for work sessions, and returns to a boss-style overview

This version should **not** include AI task generation yet. The focus is only on the core manual workflow and a simple gamified UI.

---

## Product Direction

This is **not** a generic to-do list and **not** a calendar scheduler.

The app should feel like:
- a personal operating system
- a small company dashboard for one person
- a game-like workspace with role switching, visible progress, and earned currency

The app should help the user:
- separate responsibilities by role
- reduce overwhelm by seeing fewer things at once
- avoid context-switching
- feel rewarded for focused work
- break work into small executable tasks

---

## MVP Scope

### In scope
- Create / edit / delete roles
- Create / edit / delete tasks under roles
- Mark tasks as todo / in progress / done
- Clock in to exactly one role at a time
- Track elapsed active time for that role session
- Earn currency while clocked in based on hourly rate
- Show current balance / earnings
- Provide a simple boss dashboard showing all roles
- Provide a focused role view that hides unrelated work
- Persist data locally at first

### Out of scope for v1
- AI task generation
- Calendar / time-blocking
- Team collaboration
- Notifications
- Complex analytics
- Authentication / multi-user
- Backend sync
- Marketplace / spending currency
- Recurring tasks
- Pomodoro requirements
- Integrations with Google Calendar / Notion / etc.

---

## Core UX Concept

The app has two main modes:

### 1. Boss Mode
This is the overview / management layer.

The user can:
- see all roles
- see how many open tasks each role has
- see total earned currency
- see whether a role is currently clocked in
- enter a role
- create or organize tasks for a role

This screen should feel like:
- clear
- playful
- low-friction
- motivating
- visually simple, not corporate-heavy

### 2. Role Mode
This is execution mode.

When the user enters a role:
- only that role's tasks are visible
- the UI should reduce distraction
- there should be a very clear **Clock In / Clock Out** action
- time and earnings should be visible while clocked in
- task completion should feel satisfying and game-like

This screen should answer:
- What role am I in?
- Am I clocked in right now?
- What should I do next?
- How much have I earned this session?

---

## Gamification Layer

The gamification should stay simple for the MVP.

### Core mechanic
Each role has an hourly earning rate, or the app has one default hourly earning rate.

Examples:
- Engineer: 25 coins/hour
- Marketing: 18 coins/hour
- CEO: 15 coins/hour

Or simpler:
- global default = 20 coins/hour

### Rules
- User earns currency only while actively clocked in
- Currency accrues over time during a session
- On clock out, the session is saved and total balance updates
- Done tasks can optionally grant a small bonus later, but that is optional for MVP

### Display ideas
- Persistent currency badge in header
- Session earnings displayed live while clocked in
- Role cards can show rate, streak, or recent activity
- Task completion animation should feel rewarding but minimal

### Important note
Do not overbuild the economy. The point is simply to create a visible reward tied to focused work.

---

## UI / Design Direction

The UI should be:
- very simple
- clean and modern
- slightly playful / gamified
- visually motivating
- optimized for low friction
- not cluttered

### Design goals
- strong visual distinction between Boss Mode and Role Mode
- role cards that feel like selecting a character / class
- large obvious clock-in action
- obvious current state at all times
- low cognitive load
- mobile-responsive, but desktop-first is acceptable if the existing site already leans that way

### Suggested visual language
- rounded cards
- soft shadows
- bold labels
- clear progress indicators
- limited number of colors
- each role may have a color or icon
- reward / earnings UI should feel fun, not childish

### Important anti-goals
Avoid:
- dense dashboards
- heavy project-management UI
- tiny text everywhere
- spreadsheet feel
- complicated multi-panel layouts for the MVP

---

## Recommended Information Architecture

### Main screens

#### A. Dashboard / Boss Mode
Contains:
- top summary bar
  - total currency
  - currently active role
  - current session timer if applicable
- role cards
  - role name
  - hourly rate
  - open task count
  - done task count
  - button to enter role
- create role button
- quick add task entry per role or via modal

#### B. Role Detail / Focus Mode
Contains:
- role header
  - role name
  - role icon / color
  - hourly rate
  - current session time
  - current session earnings
- big clock in / clock out button
- task list for this role only
- quick-add task input
- optional sections:
  - todo
  - in progress
  - done
- return to dashboard button

#### C. Session Summary (lightweight)
When clocking out, show:
- session duration
- currency earned
- tasks completed during session
- button to return to dashboard
- optional encouraging copy

---

## Functional Requirements

### Roles
User can:
- create a role
- rename a role
- delete a role
- set role color/icon
- set hourly earning rate for that role

Validation:
- role name required
- no duplicate role names if easy to enforce
- deleting a role should either delete associated tasks or require confirmation

### Tasks
User can:
- create task under a role
- edit task text
- delete task
- mark task done / not done
- optionally mark in progress

MVP rule:
- tasks should stay lightweight
- do not add subtasks yet
- do not add due dates unless already trivial in current codebase

Validation:
- task text required
- keep task model simple

### Clock-In Logic
Rules:
- only one role can be clocked in at a time
- if user clocks into a new role while another is active, force explicit switch
- session begins on clock in
- session ends on clock out
- earnings are based on elapsed time * role hourly rate
- active timer should update live in UI

Edge cases:
- refresh during active session
- restoring active session state from local persistence
- prevent duplicate overlapping sessions

### Currency / Earnings
Must support:
- persistent total balance
- session earnings
- total lifetime earnings
- earnings derived from saved sessions

For MVP, keep this as a simple derived or persisted value.

### Sessions
Track:
- role id
- start time
- end time
- duration
- earnings
- tasks completed during session (optional but useful)

---

## Suggested Data Model

Use whatever fits the existing codebase, but conceptually:

```ts
type Role = {
  id: string
  name: string
  color?: string
  icon?: string
  hourlyRate: number
  createdAt: string
}

type TaskStatus = "todo" | "in_progress" | "done"

type Task = {
  id: string
  roleId: string
  title: string
  status: TaskStatus
  createdAt: string
  updatedAt: string
  completedAt?: string
}

type Session = {
  id: string
  roleId: string
  startTime: string
  endTime?: string
  durationSeconds?: number
  earnings?: number
  active: boolean
}

type AppState = {
  roles: Role[]
  tasks: Task[]
  sessions: Session[]
  activeSessionId?: string
  totalCurrency: number
}
```

### Notes
- Keep storage local first
- Use IDs consistently
- Avoid premature backend architecture

---

## Persistence

For the MVP, prefer:
- localStorage
- or existing lightweight client persistence in the current site

Requirements:
- roles persist
- tasks persist
- active session persists across refresh
- completed sessions persist
- currency persists or can be re-derived from sessions

Do not add backend dependencies unless the site already requires them and the refactor is cleaner that way.

---

## State Management Expectations

Cursor should keep state management simple and predictable.

### Requirements
- single source of truth for active session
- derived values for:
  - current timer
  - current earnings
  - open task counts
  - done task counts
- keep business logic separated from presentational components where possible

### Preferred direction
If the current site is React-based:
- keep or improve current structure
- centralize session / role / task logic
- avoid scattered timer logic across components

---

## Core User Flows

### Flow 1: Create first role
1. User lands on dashboard
2. User sees empty state
3. User creates role like "Engineer"
4. User optionally sets rate and color
5. Role card appears

### Flow 2: Add tasks
1. User opens a role
2. User adds a few simple tasks
3. Tasks appear in the role task list
4. User returns to dashboard

### Flow 3: Start work session
1. User enters role
2. User presses Clock In
3. Active state becomes visually obvious
4. Timer starts
5. Session earnings increase live

### Flow 4: Complete work and clock out
1. User checks off tasks during work
2. User presses Clock Out
3. Session summary appears
4. Earnings are added to total balance
5. User returns to dashboard

### Flow 5: Switch roles
1. User is clocked into Role A
2. User tries to enter or clock into Role B
3. App prompts for switch confirmation
4. Current session ends
5. New session begins under Role B

---

## UX Rules

These rules matter more than extra features.

1. **Only one active role at a time**
2. **Role view should hide unrelated tasks**
3. **Clock-in state should always be obvious**
4. **Task creation should be frictionless**
5. **The dashboard should motivate action, not become a planning trap**
6. **Do not require time estimates for tasks**
7. **Reward focused work, not planning complexity**

---

## Refactor Priorities

Cursor should refactor in phases.

### Phase 1: Understand current site
- inspect current routing, component structure, and state flow
- identify reusable layout/components
- identify where current task-like or dashboard-like UI already exists
- preserve what is useful
- remove or de-emphasize anything that conflicts with the simpler MVP

### Phase 2: Establish app model
- add role/task/session data model
- add local persistence
- create clean state logic for active session and currency

### Phase 3: Build Boss Mode
- dashboard overview
- role cards
- create role flow
- task counts
- total currency display

### Phase 4: Build Role Mode
- isolated role screen
- task list
- clock in/out controls
- live timer
- live session earnings

### Phase 5: Add session summary + polish
- session summary modal/view
- clearer empty states
- small reward microinteractions
- responsive cleanup
- visual polish

---

## Refactoring Guidance for Cursor

When refactoring:
- prioritize simplicity over extensibility
- remove unnecessary complexity if it does not support the MVP
- prefer clear naming around `roles`, `tasks`, `sessions`, `currency`, `activeSession`
- isolate domain logic from UI code
- avoid overengineering abstractions
- keep components small where reasonable
- create reusable UI primitives only when they actually reduce duplication

### Important
Do not scaffold future AI integration yet.
Do not build placeholder fake AI screens.
Do not add complex permission systems or accounts.
Do not add too many settings.

The app should feel complete as a manual workflow before any AI layer is added.

---

## Suggested MVP Component Breakdown

Example only; adapt to existing stack.

- `DashboardPage`
- `RoleCard`
- `CreateRoleModal`
- `RolePage`
- `TaskList`
- `TaskItem`
- `QuickAddTask`
- `ClockInButton`
- `SessionTimer`
- `CurrencyBadge`
- `SessionSummaryModal`

Possible domain/state layer:
- `useAppStore` or equivalent
- `roleService`
- `taskService`
- `sessionService`
- `currencyUtils`

---

## Empty States

These matter a lot for first-time use.

### Empty dashboard
Message should explain:
- create a role to get started
- examples of roles
- this app is about separating work by role and earning rewards through focused sessions

### Empty role
Prompt user to:
- add 1 to 3 small tasks
- then clock in

---

## Success Criteria for MVP

The MVP is successful if a user can:

1. create roles
2. add tasks under each role
3. clock into exactly one role
4. work from an isolated role view
5. earn visible currency as time passes
6. clock out and see progress
7. come back after refresh and still have their state

If these are working cleanly, the MVP is good enough.

---

## Nice-to-Haves Only If Easy

Only add these if very cheap and they do not delay core functionality:
- role icons
- task completion animation
- streak count by day
- role-specific background tint
- session history list
- small “earnings today” stat

These are secondary.

---

## Future Ideas (Do Not Build Yet)

These are future phases only:
- AI-assisted task breakdown
- AI boss planner
- stuck-mode prompts
- adaptive task packet generation
- reward store / spending currency
- achievements
- task difficulty multipliers
- recurring routines
- analytics on focus time by role
- cross-device sync
- mobile app

---

## Final Instruction to Cursor

Refactor the existing website into a **focused role-based productivity MVP** with:
- manual roles
- manual tasks
- single active clock-in session
- live earnings from hourly rates
- boss dashboard + isolated role mode
- simple local persistence
- clean gamified UI

Do not overbuild. Make the smallest version that feels coherent, motivating, and usable.
