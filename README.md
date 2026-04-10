# The Boss

**The Boss** is a local-first productivity app for working in **roles** (contexts or “jobs”), managing **tasks**, and **clocking in** to one role at a time. By default, data stays in the browser (**`localStorage`**). **Optional [Supabase](https://supabase.com)** sync lets you sign in with **email and password** and persist the same JSON state in your project’s database; you do not need the Python backend for either mode.

| Route | What it is |
|-------|------------|
| **`/`** | Progress landing — optional “north star” number and label, link into the app |
| **`/boss`** | Main dashboard — roles, tasks, sessions, calendar-style views, KPIs |
| **`/login`** | Sign in / create account (Supabase; only when env vars are set) |
| **`/forgot-password`** | Request a password reset email |
| **`/account/password`** | Set a new password (after reset email link, or from **Change password** on `/login` while signed in) |

### Optional: Supabase (cloud sync)

Assume you already created a Supabase **project** and can open its dashboard.

#### 1. Copy your API URL and anon key (for `.env.local`)

1. In the Supabase dashboard, open **your project** (not the org home screen).
2. Click the **gear icon** (**Project Settings**) in the left sidebar.
3. Click **API** (under *Project Settings*).
4. Find **Project URL** — looks like `https://abcdefgh.supabase.co`. Copy it. This value is your `NEXT_PUBLIC_SUPABASE_URL`.
5. On the same page, under **Project API keys**, copy the **`anon` `public`** key (not the `service_role` key). That is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`.  
   The anon key is safe to put in frontend env vars; RLS on your tables restricts what each user can read/write.

#### 2. Authentication → URL Configuration

Supabase only allows the browser to be sent back to URLs you list here. That matters for **email confirmation** (if enabled) and any flow that returns through `/auth/callback`.

1. **Authentication** → **URL Configuration**.
2. **Site URL** → `http://localhost:3000` (or your deployed URL later).
3. **Redirect URLs** → add `http://localhost:3000/auth/callback` (and your production callback when you deploy). Password reset emails use this URL too (`?next=/account/password`), so you do not need a separate entry for `/account/password` unless Supabase asks for it explicitly.
4. Save if prompted.

#### 3. Turn on email + password

1. **Authentication** → **Providers** → **Email**.
2. Turn **Email provider** on.
3. Ensure users can sign up with a password (defaults usually allow **email + password**; disable “magic link only” style restrictions if your project had that).
4. For **higher conversion** (no inbox step on sign-up): turn **Confirm email** **off** so new accounts get a session immediately after **Create account**. If you leave it **on**, users must click the confirmation email before they can sign in.
5. Google/GitHub are optional.

#### 4. Create the database table (SQL migration)

1. In the left sidebar, click **SQL Editor**.
2. Click **New query**.
3. Open [`frontend/supabase/migrations/001_boss_app_state.sql`](frontend/supabase/migrations/001_boss_app_state.sql) in your editor, copy **all** of its contents, paste into the Supabase SQL Editor, and click **Run**.
4. You should see success. Under **Table Editor**, you should eventually see a table **`boss_app_state`** after you sign in and use the app (or you can confirm it exists in the *Database* → *Tables* view).

#### 5. Wire env vars into the Next.js app

There is **no** committed `.env` or `.env.local` in the repo on purpose (those files hold secrets and are **gitignored**). You create `.env.local` yourself next to the template.

1. Open the **`frontend`** folder in your project.
2. Find **[`frontend/supabase.env.template`](frontend/supabase.env.template)** — this file is safe to commit and only contains placeholders.
3. **Copy** that file and save the copy as **`frontend/.env.local`** (leading dot, no `.txt` extension). In VS Code / Cursor: *File → New File*, save as `.env.local` in `frontend/`, or duplicate the template and rename.
4. Replace the two lines:

   - `PASTE_YOUR_PROJECT_URL_HERE` → your Supabase **Project URL** (from step 1).
   - `PASTE_YOUR_ANON_KEY_HERE` → your **`anon` `public`** key.

   No quotes needed around the values.

5. Stop and restart **`npm run dev`** so Next.js loads `.env.local`.

*(Alternative: copy [`frontend/.env.example`](frontend/.env.example) to `.env.local` instead — same variables.)*

#### 6. Try it in the app

1. Open **http://localhost:3000/boss**.
2. Sidebar → **Sign in to sync** → **`/login`**.
3. **Create account** (email + password) or **Sign in**. You should land on `/boss` signed in when confirmation email is off (or after you confirm, if it’s on).
4. **Table Editor** → **`boss_app_state`** should gain a row after you use the app.

If redirects after an email (confirmation, etc.) fail, re-check **Redirect URLs** and that you use the same host as **Site URL** (`localhost` vs `127.0.0.1`).

---

## Repository layout

| Part | Path | When you need it |
|------|------|-------------------|
| **The Boss (primary)** | [`frontend/`](frontend/) | Always — Next.js app |
| **DocAI backend (optional)** | [`backend/`](backend/) | AI chat, PDF tooling, extension iframe, RAG, etc. |
| **Canvas extension (optional)** | [`extension/`](extension/) | Sidebar on Canvas that loads the dev frontend |

This repo also retains **DocAI**-oriented backend code (FastAPI, agents, bandit endpoints, tests). The **current** Boss UI does not call those APIs.

---

## Quick start (The Boss only)

**Requirements:** Node.js 18+ (20+ recommended).

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** — use **Enter Boss** to go to **http://localhost:3000/boss**.

More detail (mental model for roles vs jobs, clock-in behavior): **[RUNNING_LOCALLY.md](RUNNING_LOCALLY.md)**.

### Production build

```powershell
cd frontend
npm run build
npm start
```

---

## Optional: Python backend

Used for legacy DocAI features (chat, embeddings, file flows), not for Boss roles/tasks.

```powershell
cd backend
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Environment variables: see **`backend/.env.example`** (e.g. `THEBOSS_AI_ENABLED`, API keys).

Docker-based setup (full stack): **[documentation/doc1.md](documentation/doc1.md)** — note that doc still references the original course repo name; adjust paths to match your clone.

---

## Optional: Browser extension (Canvas)

The extension injects a sidebar on Canvas that expects the **frontend dev server** (and typically the **backend**) on localhost. Load **`extension/`** as an unpacked extension; full steps: **[extension/README.md](extension/README.md)**.

---

## Tech stack (high level)

- **The Boss UI:** Next.js 15, React 19, TypeScript, Tailwind CSS 4  
- **Optional sync:** Supabase Auth + Postgres (`boss_app_state` JSON document)  
- **Backend:** Python, FastAPI (DocAI / legacy integration)  
- **Elsewhere in repo:** MongoDB, S3, LLM providers — used by backend paths, not by the Boss MVP UI

---

## Testing

**Backend** (from `backend/` with venv active):

```powershell
pytest tests/ -v
```

Example with coverage for a specific module:

```powershell
pytest tests/test_general_tool.py --cov=ai_agent --cov-report=term-missing -v
```

BDD-style tests and notes: **[backend/README_BDD.md](backend/README_BDD.md)**, **[backend/tests/README.md](backend/tests/README.md)**.

**Frontend:** there is no Jest/Vitest suite wired to the current Next.js app router layout; add tests under `frontend/` as the project grows.

---

## Legacy: Multi-armed bandit (backend)

The FastAPI app still exposes **`/api/bandit/*`** endpoints (epsilon-greedy Send-button experiment) for the older chat UI. The **Boss** Next.js app does not use them. Implementation: `backend/bandit/algorithm.py`, routes in `backend/main.py`.

---

## More documentation

- [RUNNING_LOCALLY.md](RUNNING_LOCALLY.md) — ports, Boss vs backend  
- [role_task_mvp_refactor_brief.md](role_task_mvp_refactor_brief.md) — product / refactor notes  
- [documentation/](documentation/) — additional dashboards / Docker guides (some names may predate this fork)
