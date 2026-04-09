# Running Locally

## The Boss UI (primary)

The **role / task / clock-in** app lives in **`frontend/`** (Next.js). It does not require the Python backend for core flows (data is in `localStorage`).

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** — that is The Boss dashboard.

**First launch:** three default **jobs** (roles) are created automatically: **Programmer**, **Marketing**, and **Student**. You can rename them, add more, or delete them.

### Mental model (roles vs “jobs”)

- A **role** is a **context** you work in — the “job” or hat you’re wearing while clocked in.
- **Programmer / Marketing / Student** are **starters** so the dashboard isn’t empty.
- You **clock in to one role at a time**; switching ends the current session (with confirmation).

---

## Python backend (optional — DocAI / AI / extension)

The FastAPI app in **`backend/`** powers legacy AI chat, PDF compile, etc. **The Boss MVP does not depend on it** for roles and tasks.

| Topic | Notes |
|-------|--------|
| **OpenAI API key** | Embeddings / RAG — not used by The Boss UI. |
| **Anthropic API key** | Chat when AI enabled — see `THEBOSS_AI_ENABLED` in `.env.example`. |
| **Port** | Backend default: **8000**. |

```powershell
cd backend
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## Summary

| What | Where | Port |
|------|--------|------|
| **The Boss** | `frontend/` | **3000** (`npm run dev`) |
| Backend (optional) | `backend/` | **8000** |
