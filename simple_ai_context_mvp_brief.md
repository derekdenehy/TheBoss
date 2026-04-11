# Simple AI Context MVP Brief for Cursor

## Goal

Implement the **smallest useful AI context system** for the app.

Do not build a large memory architecture yet.
Do not build a multi-file knowledge system yet.
Do not build complex inference, confidence scoring, or long-term behavioral learning yet.

Start with a very small per-user context model that gives the AI enough information to:
- understand what the user is mainly working on
- understand what matters most right now
- understand how to phrase and suggest tasks
- support simple Boss-tab AI assistance later

This should be the first foundation only.

---

## Product Principle

Keep this version extremely small and easy to maintain.

The AI does **not** need to know everything about the user.
It only needs enough context to help with:
- picking useful tasks
- prioritizing current work
- framing tasks in a style that fits the user
- helping the Boss tab recommend a good next move

---

## Scope for v1

### Build only these 4 context objects
1. `profile`
2. `goals`
3. `projects`
4. `workingState`

That is all.

Do not add:
- separate pattern files
- long-term memory systems
- confidence tiers
- auto-generated behavioral summaries
- large daily logs
- per-role knowledge documents
- retrieval systems
- embeddings
- heavy prompt orchestration

---

## What each object should contain

### 1. profile
Purpose:
Store basic user setup and stable preferences.

Fields:
- active roles
- preferred task style
- preferred warm-up ritual
- common blockers

Example:
```json
{
  "roles": ["CEO", "Engineer", "Marketing"],
  "preferredTaskStyle": "small concrete next actions",
  "preferredWarmup": "email-check",
  "commonBlockers": [
    "overthinking priorities",
    "avoiding vague tasks"
  ]
}
```

### 2. goals
Purpose:
Store what matters most overall.

Fields:
- main goal
- current priority
- optional secondary priority

Example:
```json
{
  "mainGoal": "Grow Pumped",
  "currentPriority": "distribution and gym acquisition",
  "secondaryPriority": "product reliability"
}
```

### 3. projects
Purpose:
Store a short list of current projects with minimal context.

Fields per project:
- name
- summary
- phase
- active workstreams
- current bottleneck

Example:
```json
[
  {
    "name": "Pumped",
    "summary": "Gym-focused social app",
    "phase": "growth validation",
    "workstreams": ["engineering", "outreach", "marketing"],
    "bottleneck": "distribution"
  }
]
```

### 4. workingState
Purpose:
Store what is live right now.

Fields:
- in progress
- urgent
- blocked
- avoiding

Example:
```json
{
  "inProgress": ["gym outreach", "fix onboarding flow"],
  "urgent": ["follow up with gym leads"],
  "blocked": ["unclear root cause of onboarding bug"],
  "avoiding": ["large vague engineering tasks"]
}
```

---

## MVP Storage Recommendation

Use **one single JSON object per user** at first.

Do not create multiple files on disk yet.
Do not create a folder-based document system yet.

Start with something conceptually like:

```json
{
  "profile": {},
  "goals": {},
  "projects": [],
  "workingState": {}
}
```

This is much easier to implement, update, and debug.

If the existing app already has a backend, store this in the simplest possible place that fits the current architecture.
If the existing app is still local-first, store it locally for now.

### Preferred rule
Choose the simplest persistence option already consistent with the current codebase.

---

## UI / Setup Flow

### On first user setup
Create a very small onboarding flow that asks for:

1. active roles
2. main current project
3. main goal right now
4. what kind of task suggestions help most
5. preferred warm-up ritual
6. biggest common blocker

Do not make onboarding long.
It should feel fast and useful.

### Example onboarding prompts
- What roles do you usually switch between?
- What project are you mainly trying to move right now?
- What is your main goal at the moment?
- How should tasks be phrased for you?
- What warm-up helps you enter work?
- What usually gets you stuck?

Use these answers to create the initial context object.

---

## Simple Update Strategy

Do not try to update everything automatically.

For v1, updates should come from 3 sources only:

### 1. user-edited setup
The user can manually edit:
- roles
- goals
- projects
- warm-up preference
- blockers

### 2. app-driven working state updates
The app can update:
- inProgress
- urgent
- blocked
- avoiding

This can happen through normal product usage, for example:
- when user marks something in progress
- when user flags a task as blocked
- when user identifies something as urgent
- when user says they are avoiding something

### 3. simple AI/session updates later
Leave room for AI to suggest updates later, but do not implement advanced auto-learning yet.

---

## Ownership Rules

Keep ownership simple.

### User-owned
- profile
- goals
- projects

### Mixed / app-updated
- workingState

That is enough for now.

Do not build complicated source attribution yet.

---

## How AI should use this context later

When AI is called in the Boss tab, it should use context in this order:

1. `workingState`
2. `goals`
3. `projects`
4. `profile`

Reason:
- first understand what is happening now
- then understand what matters strategically
- then understand relevant project context
- then frame output in the user’s preferred style

This is enough for the first AI-assisted task recommendation flow.

---

## Suggested Type Shape

Adapt naming to the current stack, but conceptually:

```ts
type UserProfile = {
  roles: string[]
  preferredTaskStyle: string
  preferredWarmup: string
  commonBlockers: string[]
}

type UserGoals = {
  mainGoal: string
  currentPriority: string
  secondaryPriority?: string
}

type ProjectContext = {
  name: string
  summary: string
  phase: string
  workstreams: string[]
  bottleneck?: string
}

type WorkingState = {
  inProgress: string[]
  urgent: string[]
  blocked: string[]
  avoiding: string[]
}

type AIContext = {
  profile: UserProfile
  goals: UserGoals
  projects: ProjectContext[]
  workingState: WorkingState
}
```

---

## Initial Example Object

```json
{
  "profile": {
    "roles": ["CEO", "Engineer", "Marketing"],
    "preferredTaskStyle": "small concrete next actions",
    "preferredWarmup": "email-check",
    "commonBlockers": [
      "overthinking priorities",
      "avoiding vague tasks"
    ]
  },
  "goals": {
    "mainGoal": "Grow Pumped",
    "currentPriority": "distribution and gym acquisition",
    "secondaryPriority": "product reliability"
  },
  "projects": [
    {
      "name": "Pumped",
      "summary": "Gym-focused social app",
      "phase": "growth validation",
      "workstreams": ["engineering", "outreach", "marketing"],
      "bottleneck": "distribution"
    }
  ],
  "workingState": {
    "inProgress": ["gym outreach", "fix onboarding flow"],
    "urgent": ["follow up with gym leads"],
    "blocked": ["unclear root cause of onboarding bug"],
    "avoiding": ["large vague engineering tasks"]
  }
}
```

---

## UX Requirement

The user should be able to view and edit this context in a simple way.

Do not expose it as a technical JSON editor in the product UI.
Instead, create a simple settings / studio setup view that maps to these fields.

The internal data can be structured JSON.
The external UI should feel friendly and lightweight.

---

## Refactor Guidance for Cursor

Implement this in the smallest way possible:
- one context model
- one persistence path
- one onboarding/setup flow
- one edit screen
- minimal update logic

Do not over-abstract.
Do not build speculative infrastructure.
Do not build future memory systems now.

The objective is just to create a clean, minimal AI context foundation the rest of the product can build on later.

---

## Success Criteria

This MVP is successful if:

1. a new user can fill out a quick setup flow
2. the app creates a simple context object for that user
3. the user can later edit the core context
4. the working state can be updated during normal app usage
5. the AI layer will later have enough structured context to make better task suggestions

That is enough for version one.
