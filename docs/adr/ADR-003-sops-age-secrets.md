# ADR-003: SOPS+age for Secret Management

**Status:** Accepted
**Date:** 2026-03-09
**Decision makers:** Yann Abadie

## Context
Audit found 15+ plaintext credentials committed to git (.env, claude_desktop_config.json). Need encryption at-rest that works without extra infrastructure.

## Decision
SOPS with age encryption. `.env.encrypted` versionable in git, decrypted at deployment time. No external secret server required (Vault would be overkill for current team size).

## Consequences
### Positive
- Simple tooling with no infrastructure dependency
- Encrypted secrets are versionable in git alongside the code that uses them
- Works fully offline — no network dependency for secret access

### Negative
- Key distribution is manual (age private key must be securely shared out-of-band)
- No automatic secret rotation — must be done manually and re-encrypted
- No audit log of secret access (unlike Vault or cloud KMS)
