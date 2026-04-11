# Onboarding AI — Design Brief

## Purpose of This Document

This document captures the core design philosophy and engineering constraints for the Boss Tab onboarding AI flow. Read this before touching any implementation. The onboarding is the most important moment in the product — getting it wrong means losing users before they see any value.

---

## The Single Most Important Principle

**The goal of onboarding is not to collect context. It is to make the user feel like everything is under control.**

Context is a byproduct of a good first conversation. If the user leaves the onboarding feeling calmer and more directed than when they arrived, the onboarding succeeded — even if the context object is only 40% filled. Context will grow over time through daily use. Relief cannot be retroactively delivered.

This distinction must inform every decision about the flow.

---

## Who This Is For

The target user has ADHD or ADHD-adjacent executive function challenges. This shapes everything.

Key behavioral facts about this user:
- They are already overwhelmed before they open the app
- Asking them to organize their thoughts before starting is a barrier, not a feature
- They cannot answer abstract questions like "what's most important to you right now"
- They respond well to being told what to do by something they trust
- The moment of relief — when someone else holds the chaos — is extremely powerful
- Long forms, multi-step wizards, and structured intake flows will lose them
- They need to feel progress within the first 60 seconds

The product is essentially providing the function of a calm, competent external mind. The AI is not a tool they use. It is an assistant that takes things off their plate.

---

## The Brain Dump First

The first thing the AI asks is not a structured question. It is an invitation to unload:

> "Before we set anything up — just dump everything you're managing right now. Don't organize it. Don't prioritize it. Just get it out."

The phrase "don't organize it" is deliberate. It removes the pressure to present things well, which is a real cognitive barrier for ADHD users who feel they need to be coherent before asking for help.

This single message should produce a chaotic, honest list of whatever is in the user's head. That raw input is more valuable than any structured form response because it reveals:
- What roles the user has (student, founder, employee, caretaker...)
- What has a deadline attached
- What is emotionally loaded vs. logistically pending
- What is concrete vs. vague
- The user's natural language and communication style

---

## What the AI Does With the Dump

After receiving the brain dump, the AI must do two things simultaneously but only surface one of them.

**Silently (never shown to user):**
- Identify implied roles
- Flag items with dates or deadlines
- Identify what sounds most emotionally urgent
- Distinguish quick tasks from large projects
- Infer what kind of user this is (student, professional, founder, mixed)
- Begin populating the context object fields: roles, workingState, deadlines, projects

**Shown to user:**
Pick one thing. Not a reorganized list. Not a summary. One thing that jumped out, with a reason, and one follow-up question.

Example response:

> "Okay. There's a lot here and that makes sense. The thing that jumps out is [X] — sounds like it has a deadline and has probably been sitting in the back of your mind. Let's get that one clear first. What actually needs to happen with it?"

This response:
- Acknowledges the volume without cataloguing it back to them
- Immediately reduces the cognitive load from everything to one thing
- Makes the user feel seen (the AI noticed the right thing)
- Ends with exactly one concrete question

The user's experience of this moment should be: "oh, someone's got this."

---

## The Emotional Arc of Onboarding

The AI needs to engineer a specific emotional progression:

1. **Dump** — User unloads everything, feels the relief of externalization
2. **Seen** — AI responds in a way that makes the user feel understood, not processed
3. **Focused** — AI picks one thing, user's cognitive load drops sharply
4. **Moving** — User takes one small action (answers a follow-up, confirms a deadline, names a next step)
5. **In control** — User ends onboarding feeling like there is a plan, even if the plan is just "we start here"

If the user reaches step 5, onboarding is a success regardless of how much context was captured.

---

## What Onboarding Must Not Do

These are hard constraints. Violating them will lose the user.

- **Do not ask multiple questions at once.** One question, always. Ever.
- **Do not reflect the entire dump back to the user.** "I see you're managing X, Y, Z, A, B, C..." is cognitive overload, not help.
- **Do not use productivity language.** No time-boxing, no MoSCoW prioritization, no "what's your north star."
- **Do not ask the user to prioritize.** The AI does the prioritizing. That is the point.
- **Do not make the user feel analyzed.** The AI is helpful, not clinical.
- **Do not use bullet points or lists in AI responses during onboarding.** Short paragraphs only. Lists feel like forms.
- **Do not gate daily use on completing onboarding.** If a user skips or drops off mid-onboarding, they can still use the product. Context is optional, not required.
- **Do not repeat onboarding.** Once the user has had their first brain dump session, onboarding is done. Context fills over time through normal use.

---

## The Only Things Onboarding Must Capture

Onboarding needs to produce exactly two things to be considered complete:

1. **An initial context object** — partially filled is fine. Enough for the AI to give day-one guidance.
2. **The warmup ritual** — how the user eases into work. This is asked as a single casual follow-up after the brain dump is processed.

Everything else — full role taxonomy, complete project list, stated goals, blockers — accumulates naturally through continued use.

The warmup question is asked like this, not like a form field:

> "One more thing — how do you usually ease into work? Like what's the first thing you do before you actually start? Some people check email, some people make coffee and review their calendar..."

This gets the warmup ritual without making it feel like a configuration setting.

---

## Context Extraction (The Silent Layer)

After the brain dump, a structured extraction step should run — either as a second model call or as part of the same response generation — that converts the raw conversation into updates to the context object.

The user never sees this. It happens in the background.

The extraction should populate:
- `profile.roles` — inferred from what the user described
- `profile.preferredWarmup` — from the warmup follow-up
- `workingState.inProgress` — active things mentioned
- `workingState.urgent` — anything with a deadline or emotional weight
- `projects` — any named project or major effort mentioned
- `deadlines` — any date mentioned, attached to the relevant item

The context object starts sparse. That is fine. The system must work with incomplete context from day one.

---

## Mode Flags

The system needs a clear mode flag to distinguish onboarding from daily use.

```json
{
  "onboardingComplete": false,
  "firstSessionAt": null
}
```

- `onboardingComplete: false` → AI is in onboarding mode. First message is the brain dump invite.
- `onboardingComplete: true` → AI is in daily guidance mode. Morning check-in, session planning, task sequencing.

Onboarding mode ends after the brain dump is processed and the warmup ritual is captured. Not before, not requiring more.

---

## How Context Grows After Onboarding

Onboarding is deliberately minimal. Context accumulates through:

**Daily session start** — AI opens with "what's new today?" or "anything changed since yesterday?" One optional answer updates `workingState`.

**Deadline mentions** — Whenever the user mentions a date or deadline in any conversation, the AI flags it: "Want me to track that?" If yes, it goes into the context. Over a week the calendar fills naturally.

**Task completion** — When something is marked done, the AI might ask: "Nice — anything new come up I should know about?" One question, optional.

**Role clarification** — AI infers roles from the brain dump but may be wrong. It confirms gently when relevant, not as a form step.

**User-initiated edits** — There should always be a settings view where the user can manually view and edit their context. This is not the primary update path but it must exist.

---

## The Momentum Model (Daily Guidance After Onboarding)

Once onboarding is complete, the AI's daily job is to sequence the user's work in a way that builds momentum. The framework is three layers:

**Layer 0 — Warmup**
The user's chosen ritual. Email, Slack review, calendar check. The AI acknowledges it started, does not interrupt it, and uses it as the signal that the session has begun.

**Layer 1 — Activation Tasks**
Concrete, scoped, short tasks with a clear done state. These should feel almost too easy. Their purpose is not productivity — it is the sense of motion. Earlier tasks exist to build the feeling that you are already moving.

**Layer 2 — Deep Work**
The real thing. By the time the user reaches Layer 2 they are already in motion, which is the whole game for ADHD users.

The AI decides which layer a task belongs in based on:
- Vagueness of description (vague = harder, Layer 2)
- Deadline proximity (urgent pulls items up)
- User's stated blockers (if "vague tasks" is a blocker, AI breaks things down automatically)
- Whether the task has a clear done state

The AI presents the day's sequence like this, not as a schedule:

> "Here's a start for today:
> Check your email (your warmup), then re-read your notes from last class (low resistance, 15 min), then get into problem set questions 1-3.
> Does that feel right or do you want to adjust?"

Short. Specific. Ends with an opt-out. Never rigid.

---

## AI Persona and Tone

The AI's character during onboarding and daily guidance must be deliberately engineered in the system prompt. It will not emerge naturally from a base model without instruction.

**The AI should feel like:**
A calm, competent person who has handled chaos before and is not rattled by yours. Someone who takes things off your plate without making you feel managed.

**Tone rules:**
- Short sentences. Short paragraphs. No walls of text.
- Direct without being cold.
- Confident without being bossy.
- Warm without being performative.
- Never uses exclamation points to signal enthusiasm.
- Never uses the word "absolutely," "certainly," or "of course."
- Never opens a response with "Great!" or "Sure!"

**Structural rules for AI responses:**
- No bullet points during onboarding.
- No more than one question per message, ever.
- Never list everything back to the user.
- Always end with either a question or a concrete suggestion — not both.

---

## System Prompt Engineering Notes

The onboarding mode system prompt needs to explicitly instruct the model on:

1. Its role in this moment (collect a brain dump, not a structured intake)
2. What it is silently trying to extract (context fields)
3. What it must never do (see constraints above)
4. How to pick which item from the dump to focus on (deadline > emotional urgency > vagueness)
5. The tone and persona described above
6. That incompleteness is okay — the goal is relief, not completeness

The daily guidance system prompt is separate and distinct. Do not conflate the two. Onboarding mode ends. Daily mode begins. They have different jobs.

---

## Before Writing Any Code

Write out the onboarding conversation as a script for at least three user types:

1. **Overwhelmed student** — multiple classes, an assignment due soon, some personal life admin
2. **Early-stage founder** — multiple workstreams, unclear priorities, context switching between roles
3. **Person with a day job and a side project** — split attention, guilt about both

For each script, write word-for-word what the AI says and what a realistic user responds. Include at least one case where the user gives a messy or unclear answer.

That script will expose every edge case and reveal exactly what the system prompt needs to handle. The script is the product design. The implementation follows from the script.

---

## Success Criteria for Onboarding

Onboarding is successful if:

1. The user feels calmer and more directed at the end than at the start
2. The AI identified one concrete thing to focus on first
3. The warmup ritual was captured
4. The context object has enough to generate day-one guidance (even if sparse)
5. The user saw one example of what the product does for them daily

That is enough. Do not optimize for context completeness. Optimize for the user feeling like they are in good hands.
