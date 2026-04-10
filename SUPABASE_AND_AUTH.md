# Supabase & Auth — Simple Guide

You don’t need to know any of this to run the app. This file explains what these things are and how to set them up **only if you want** sign-in/sign-up.

---

## What is this stuff?

- **Supabase** = A free online service that gives you:
  - A **database** (where the app can store things like your courses and files).
  - **Auth** = “who is using the app?” — sign up, sign in, sign out (**The Boss** uses email + password on `/login`).

- **Auth** in this project = The app can show a **login/sign-up page**. After you sign in, it knows “this is you” and can tie your data (courses, files) to your account.

You do **not** need Supabase or auth to run the app locally. The chat, file upload, and PDF stuff work without it. Supabase is only needed if you want:
- Users to sign in and have their own data, or  
- Features that use the database (e.g. Canvas scraper, saving courses).

---

## Do I need to set this up?

- **No** — if you only want to run the app on your computer and use the AI/chat/PDF features.  
  → Use **RUNNING_LOCALLY.md** and ignore Supabase.

- **Yes** — if you want a login/sign-up screen and to save user-specific data in a database.  
  → Follow the steps below.

---

## Step-by-step: Turn on Supabase and auth

### 1. Create a Supabase account

1. Go to **[supabase.com](https://supabase.com)** and click **Start your project**.
2. Sign up (GitHub or email).
3. You’ll be in the Supabase dashboard.

### 2. Create a new project

1. Click **New project**.
2. Pick an **organization** (or create one).
3. Choose a **name** (e.g. `course-sidekick`) and a **database password** (save it somewhere safe).
4. Pick a **region** close to you.
5. Click **Create new project** and wait a minute until it’s ready.

### 3. Get your project URL and keys

1. In the left sidebar, open **Project Settings** (gear icon).
2. Click **API** in the left menu.
3. You’ll see:
   - **Project URL** — e.g. `https://abcdefgh.supabase.co`
   - **anon public** key — a long string (safe to use in the frontend)
   - **service_role** key — another long string (secret; only for backend, never put in frontend code)

Keep this page open; you’ll copy these into your `.env` files.

### 4. Create the database tables

The app expects certain tables (users, courses, etc.). Supabase starts with an empty database, so you create them once:

1. In the Supabase dashboard, open **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open the file **`backend/db/schema.sql`** in this project and copy **all** of its contents.
4. Paste into the SQL Editor and click **Run** (or press Ctrl+Enter).
5. You should see “Success” and no errors.

### 5. Put the keys in your app

**Backend (project root or backend folder):**

Edit your **`.env`** file (copy from `.env.example` if you don’t have one) and set:

```env
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_public_key_here
SUPABASE_JWT_SECRET=your_jwt_secret_here
```

- **SUPABASE_URL** = Project URL from step 3.  
- **SUPABASE_SERVICE_KEY** = the **service_role** key from step 3.  
- **SUPABASE_ANON_KEY** = the **anon public** key from step 3.  
- **SUPABASE_JWT_SECRET** = In Supabase: **Project Settings → API**. Scroll to **JWT Settings** and copy the **JWT Secret**.

**Frontend:**

In the **`frontend`** folder, create or edit **`.env`** and set:

```env
REACT_APP_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_public_key_here
```

Use the same URL and **anon** key as above (never put the service_role key in the frontend).

### 6. Install the Supabase package in the frontend

In a terminal, from the **project root**:

```powershell
cd frontend
npm install @supabase/supabase-js
```

### 7. Run the app

- Start the **backend**: from `backend`, run `uvicorn main:app --reload --host 0.0.0.0 --port 8000` (see **RUNNING_LOCALLY.md**).
- Start the **frontend**: from `frontend`, run `npm start`.

If everything is set up, the app will use Supabase for auth and database. If you leave the Supabase env vars empty, the app still runs without login.

---

## Summary

| You want… | Do this |
|-----------|--------|
| Just run the app and use AI/chat/PDF | Use **RUNNING_LOCALLY.md**. Don’t set up Supabase. |
| Login/sign-up and user-specific data | Follow the steps above: create Supabase project, run `schema.sql`, add keys to `.env` and `frontend/.env`, run `npm install @supabase/supabase-js` in `frontend`. |

If something doesn’t work, double-check: (1) both `.env` files have the right keys, (2) you ran the full `schema.sql` in the Supabase SQL Editor, (3) you restarted the backend and frontend after changing `.env`.
