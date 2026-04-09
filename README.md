# The Boss

**The Boss** is a local-first productivity app for working in **roles** (contexts or “jobs”), managing **tasks**, and **clocking in** to one role at a time. Data for the MVP lives in the browser (**`localStorage`**); you do not need the Python backend to use the main UI.

| Route | What it is |
|-------|------------|
| **`/`** | Progress landing — optional “north star” number and label, link into the app |
| **`/boss`** | Main dashboard — roles, tasks, sessions, calendar-style views, KPIs |

On first launch, three starter roles are created: **Programmer**, **Marketing**, and **Student** (you can rename, add, or remove them).

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
