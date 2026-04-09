"""One-time script to verify Supabase connection. Run: python check_supabase.py"""
import sys
import os
from pathlib import Path

# Load root .env (without requiring python-dotenv)
_env_path = Path(__file__).resolve().parent.parent / ".env"
if _env_path.exists():
    for line in _env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            key, value = key.strip(), value.strip().strip("'\"")
            if key and value:
                os.environ.setdefault(key, value)

def main():
    out = []
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        out.append("FAIL: SUPABASE_URL or SUPABASE_SERVICE_KEY missing in .env")
        out.append("  (URL set: %s, Key set: %s)" % (bool(url), bool(key)))
        return "\n".join(out)
    try:
        from db.client import get_db
        db = get_db()
        db.table("users").select("id").limit(1).execute()
        out.append("OK: Supabase connection works.")
        return "\n".join(out)
    except Exception as e:
        out.append("FAIL: %s" % e)
        return "\n".join(out)

if __name__ == "__main__":
    result = main()
    print(result)
    sys.exit(0 if result.startswith("OK") else 1)
