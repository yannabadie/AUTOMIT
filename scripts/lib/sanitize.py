"""Input sanitization for SQL queries in Kestra flows."""

import re


def sanitize_sam_account(sam: str) -> str:
    """Sanitize a SAM account name for safe use in SQL LIKE clauses.

    AD SAM accounts follow the pattern: alphanumeric + dots + hyphens.
    Raises ValueError if input contains disallowed characters.
    """
    cleaned = sam.strip()
    if not cleaned:
        raise ValueError("SAM account name is empty")
    if not re.match(r'^[a-zA-Z0-9._-]+$', cleaned):
        raise ValueError(f"SAM account contains disallowed characters: {cleaned!r}")
    if len(cleaned) > 64:
        raise ValueError(f"SAM account too long ({len(cleaned)} chars, max 64)")
    return cleaned
