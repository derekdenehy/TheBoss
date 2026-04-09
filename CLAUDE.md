# DocAI — Course Sidekick

AI-powered course assistant for students. Summarizes lecture docs, extracts deadlines, generates study aids, and provides a chat interface backed by course materials. Integrates with Canvas as a browser extension.

**See also:** `RUNNING_LOCALLY.md`, `BACKEND_SETUP.md`, `SUPABASE_AND_AUTH.md`, `backend/scraper/README_SCRAPER.md`, `extension/README.md` for more detail.

---

## Architecture

```
backend/          FastAPI + LangChain/LangGraph agent (port 8000)
frontend/         React 19 app (port 3000, proxies to backend)
extension/        Chrome extension — injects sidebar into Canvas pages
backend/scraper/  Playwright scraper that pulls Canvas content into Supabase
backend/db/       Supabase client, models, and DB operations
```

**Key backend files:**
- `backend/main.py` — FastAPI app entry point; all API routes
- `backend/ai_agent.py` — LangChain agent with tools; defines `TECTONIC_SAFE_PACKAGES`
- `backend/agentmanager.py` — manages agent lifecycle and FAISS vector store

**Key frontend files:**
- `frontend/src/pages/ChatPage.jsx` — main chat UI
- `frontend/src/components/` — ChatPanel, FilePanel, WritingPanel, PdfPreview, PlanPanel, ConversationList, ProfileMenu
- `frontend/src/contexts/AuthContext.jsx` — Supabase auth context

---

## Dev Setup

**Python version: 3.11 or 3.12 only.** Pydantic/FastAPI do NOT support Python 3.14+. The backend will exit with an error message if you use the wrong version.

### 1. Environment variables

Copy `.env.example` to `.env` in the project root and fill in your keys:

```env
OPENAI_API_KEY=        # required for embeddings
ANTHROPIC_API_KEY=     # required for Claude chat
USER_AGENT=Course-Sidekick-v1.0
SUPABASE_URL=          # optional — only for DB/auth/scraper features
SUPABASE_SERVICE_KEY=
SUPABASE_ANON_KEY=
SUPABASE_JWT_SECRET=
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:3000   # comma-separated; set in production to deployed frontend URL
```

The backend checks both the project root `.env` and `backend/.env`. The frontend may use `frontend/.env` for `REACT_APP_*` if needed.

### 2. Backend

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate          # Windows
# source venv/bin/activate       # Mac/Linux
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm start   # http://localhost:3000
```

### 4. Docker (production / integration)

```bash
docker compose up --build
```

This serves everything on port 80 via nginx. **Not suited for extension development** — use the separate backend/frontend approach for that.

---

## Running Tests

**Backend unit tests:**
```bash
cd backend
python -m pytest tests/ -v
```

**Backend with coverage:**
```bash
cd backend
python -m pytest tests/ --cov=. --cov-report=term-missing --cov-branch -v
```

**BDD tests:**
```bash
cd backend
bash run_bdd_tests.sh
```

**Frontend tests:**
```bash
cd frontend
npm test -- --coverage --watchAll=false
```

**Coverage target: 80% statement coverage** for both backend and frontend.

---

## Conventions (when editing)

- **LaTeX:** Only use packages in `TECTONIC_SAFE_PACKAGES` in `backend/ai_agent.py`; do not add new packages outside that list.
- **API changes:** If you add or change backend routes or request/response shapes, update the frontend (and tests) that call them.
- **Bandit:** Do not remove or consolidate the bandit endpoints; they are used for A/B experimentation.
- **Dependencies:** Add Python deps to `backend/requirements.txt` and JS deps to `frontend/package.json`; avoid duplicating existing packages.
- **Tests:** Run backend tests from `backend/` and frontend tests from `frontend/`; run relevant tests after changing code.

---

## Important Constraints

### LaTeX / Tectonic
- The app compiles LaTeX to PDF using **Tectonic v0.15.0** (bundled as `tectonic.exe` in project root)
- Only use packages from the `TECTONIC_SAFE_PACKAGES` list defined at the top of `backend/ai_agent.py`
- Do NOT add LaTeX packages outside that allowlist — they will fail silently or break compilation

### AI Models
- **Anthropic Claude** is used for the main chat/agent (`ANTHROPIC_API_KEY`)
- **OpenAI** is used for embeddings (`OPENAI_API_KEY`)
- Default to `claude-sonnet-4-6` or newer when updating model references

### FAISS Vector Store
- Course documents are chunked and stored in a FAISS index managed by `AgentManager`
- The `general_tool` in `ai_agent.py` controls `k` values: 15 for "all courses" queries, 5 for assignment queries, 3 for general

### Supabase Auth
- Auth is handled via Supabase JWTs; the backend verifies tokens using `SUPABASE_JWT_SECRET`
- See `SUPABASE_AND_AUTH.md` for full auth setup details

### Multi-Armed Bandit
- The Send button has 3 variants (A/B/C) selected via epsilon-greedy bandit
- Endpoints: `GET /api/bandit/variant`, `POST /api/bandit/conversion`, `GET /api/bandit/stats`
- Do not remove or consolidate these — they are used for active experimentation

---

## Chrome Extension

Load from `extension/` folder via `chrome://extensions` → Developer mode → Load unpacked.

- Requires backend on `localhost:8000` and frontend on `localhost:3000`
- Keyboard shortcuts: `Ctrl/Cmd+K` toggles sidebar, `Esc` closes fullscreen

---

## CI

GitHub Actions workflows live in `.github/workflows/`:
- `main_ci_workflow.yml` — runs tests on push/PR
- `docker-image.yml` — builds and pushes Docker image

---

## Main API surface (backend)

- **Chat:** `POST /api/ask` — agent chat (conversation and file context); streaming may be handled in the same endpoint.
- **Bandit:** `GET /api/bandit/variant`, `POST /api/bandit/conversion`, `GET /api/bandit/stats` (do not remove).
- **Other:** conversations, files/upload, compile, plan, writing, session, history, auth — see `backend/main.py` for the full route list.
