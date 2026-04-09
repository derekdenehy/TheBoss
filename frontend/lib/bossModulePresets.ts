/**
 * Modular daily steps: users add cards from presets or blank.
 * `templateKey` is stable for future behavior (e.g. inbox integrations).
 */
import type { BossModuleTemplateKey } from './types'

export type BossModulePreset = {
  templateKey: BossModuleTemplateKey
  title: string
  /** Suggested body — user edits freely after insert */
  defaultBody: string
}

export const BOSS_MODULE_PRESETS: BossModulePreset[] = [
  {
    templateKey: 'email_triage',
    title: 'Email & inbox',
    defaultBody:
      'Skim inbox → flag what needs a task → capture 1–3 follow-ups for today (not the whole backlog).',
  },
  {
    templateKey: 'state_snapshot',
    title: 'Quick state check',
    defaultBody:
      'Yesterday left open · urgent · blocked · energy · time available today (one line each).',
  },
  {
    templateKey: 'calendar_scan',
    title: 'Calendar scan',
    defaultBody: 'What’s fixed on the calendar today? What gaps are for deep work?',
  },
  {
    templateKey: 'role_planning_hint',
    title: 'Role handoff',
    defaultBody:
      'Which 2–3 roles are on today? What’s the smallest next step per role? (Use Planning tab to commit packets.)',
  },
]
