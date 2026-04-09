"""
Central AI feature toggle for The Boss / Doc Studio backend.

Default behavior (no prompts on startup):
- If THEBOSS_AI_ENABLED is unset: AI is ON only when ANTHROPIC_API_KEY is set in the environment.
  With no key, AI stays off and the app runs without calling Anthropic.

Explicit overrides:
- THEBOSS_AI_ENABLED=true|1|yes|on  — force AI on (still requires ANTHROPIC_API_KEY for real calls).
- THEBOSS_AI_ENABLED=false|0|no|off — force AI off even if a key is present.

Re-enable after temporarily disabling: set THEBOSS_AI_ENABLED=true and ANTHROPIC_API_KEY in .env, restart.
"""

from __future__ import annotations

import os

_TRUE = ("1", "true", "yes", "on")
_FALSE = ("0", "false", "no", "off")


def ai_features_enabled() -> bool:
    raw = os.environ.get("THEBOSS_AI_ENABLED", "").strip().lower()
    if raw in _FALSE:
        return False
    if raw in _TRUE:
        return True
    # Unset: enable only when a key is present (backward-compatible; avoids getpass on import)
    return bool(os.environ.get("ANTHROPIC_API_KEY", "").strip())


def anthropic_key_configured() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY", "").strip())


def describe_why_ai_disabled() -> str:
    """Human-readable reason (for HTTP 503) when ai_features_enabled() is False."""
    raw = os.environ.get("THEBOSS_AI_ENABLED", "").strip().lower()
    if raw in _FALSE:
        return (
            "AI is turned off (THEBOSS_AI_ENABLED=false). Set THEBOSS_AI_ENABLED=true and "
            "ANTHROPIC_API_KEY in .env to re-enable, then restart the backend."
        )
    return (
        "No ANTHROPIC_API_KEY in the environment — chat is off. Add the key to .env to enable AI, "
        "or set THEBOSS_AI_ENABLED=false explicitly to acknowledge running without AI."
    )
