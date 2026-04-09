# Backend setup (Windows)

This backend **requires Python 3.11 or 3.12**. Python 3.14 is not supported (pydantic_core has no wheels for it).

## Steps

1. **Open a terminal in the `backend` folder.**

2. **Create a venv with Python 3.12** (skip if you already have a good venv):
   ```powershell
   Remove-Item -Recurse -Force venv -ErrorAction SilentlyContinue
   py -3.12 -m venv venv
   ```

3. **Activate the venv** (you must do this before every `pip` and `uvicorn` in a new terminal):
   ```powershell
   .\venv\Scripts\activate
   ```
   You should see `(venv)` at the start of your prompt.

4. **Confirm you're on 3.12:**
   ```powershell
   python --version
   ```
   Must show `Python 3.12.x`. If it shows 3.14, the venv wasn't activated or 3.12 isn't installed.

5. **Install dependencies:**
   ```powershell
   pip install -r requirements.txt
   ```

6. **Run the server:**
   ```powershell
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

If you don't have Python 3.12: install it from https://www.python.org/downloads/ or run `winget install Python.Python.3.12`, then repeat from step 2.
