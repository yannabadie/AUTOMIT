#!/usr/bin/env python3
"""
AutomIT — Sync Codex CLI tokens to ZeroClaw auth-profiles.json
Reads ~/.codex/auth.json, encrypts with ChaCha20-Poly1305, writes to ~/.zeroclaw/auth-profiles.json.

Usage: python scripts/sync-codex-tokens.py
"""
import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

CODEX_AUTH = Path.home() / ".codex" / "auth.json"
ZEROCLAW_DIR = Path.home() / ".zeroclaw"
SECRET_KEY_FILE = ZEROCLAW_DIR / ".secret_key"
AUTH_PROFILES_FILE = ZEROCLAW_DIR / "auth-profiles.json"


def encrypt(key: bytes, plaintext: str) -> str:
    nonce = os.urandom(12)
    cipher = ChaCha20Poly1305(key)
    ct = cipher.encrypt(nonce, plaintext.encode(), None)
    return "enc2:" + (nonce + ct).hex()


def main():
    # Read Codex CLI tokens
    if not CODEX_AUTH.exists():
        print(f"Codex CLI auth not found: {CODEX_AUTH}")
        print("Run: codex  (or npx @openai/codex) to authenticate first.")
        raise SystemExit(1)
    codex = json.loads(CODEX_AUTH.read_text())
    tokens = codex.get("tokens", {})
    if not tokens.get("access_token"):
        print("No access_token in Codex auth.json. Re-authenticate with: codex")
        raise SystemExit(1)

    # Read secret key
    if not SECRET_KEY_FILE.exists():
        print(f"ZeroClaw secret key not found: {SECRET_KEY_FILE}")
        print("Run: zeroclaw onboard  to initialize first.")
        raise SystemExit(1)
    key = bytes.fromhex(SECRET_KEY_FILE.read_text().strip())

    # Encrypt tokens
    now = datetime.now(timezone.utc)
    profile = {
        "schema_version": 1,
        "updated_at": now.isoformat(),
        "active_profiles": {"openai-codex": "openai-codex:default"},
        "profiles": {
            "openai-codex:default": {
                "provider": "openai-codex",
                "profile_name": "default",
                "kind": "oauth",
                "account_id": tokens.get("account_id"),
                "workspace_id": None,
                "access_token": encrypt(key, tokens["access_token"]),
                "refresh_token": encrypt(key, tokens["refresh_token"]),
                "id_token": encrypt(key, tokens["id_token"]) if tokens.get("id_token") else None,
                "token": None,
                "expires_at": (now + timedelta(days=10)).isoformat(),
                "token_type": "bearer",
                "scope": "openid profile email offline_access",
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
                "metadata": {"auth_kind": "authorization"},
            }
        },
    }

    AUTH_PROFILES_FILE.write_text(json.dumps(profile, indent=2))
    print(f"Tokens synced: {CODEX_AUTH} -> {AUTH_PROFILES_FILE}")
    print(f"Account: {tokens.get('account_id', 'unknown')}")
    print(f"Expires: {profile['profiles']['openai-codex:default']['expires_at']}")
    print(f"Last Codex refresh: {codex.get('last_refresh', 'unknown')}")


if __name__ == "__main__":
    main()
