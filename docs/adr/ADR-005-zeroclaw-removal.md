# ADR-005: ZeroClaw Removal

**Status:** Accepted
**Date:** 2026-03-09
**Decision makers:** Yann Abadie

## Context
ZeroClaw (Rust agent) bound 0.0.0.0 with OTP disabled, used curl through nginx proxy to chatgpt.com/backend-api (undocumented endpoint), required Codex token sync. Added significant attack surface and operational complexity for a role the TS control plane handles better.

## Decision
Remove ZeroClaw entirely. Control plane absorbs heartbeat/correlation/L1-L2-L3 decision-making. Kestra cron handles periodic health checks. Eliminates nginx proxy, Codex token sync, public bind, and chatgpt.com backend-api dependency.

## Consequences
### Positive
- Reduced attack surface — eliminates 5+ security findings from audit
- Simpler stack — one fewer language (Rust), one fewer runtime, no nginx sidecar
- No dependency on undocumented chatgpt.com backend-api endpoint
- Eliminates complex Codex token sync (ChaCha20-Poly1305 key sharing)

### Negative
- Lose ZeroClaw's SQLite-based local correlation memory
- Must rebuild correlation logic in control plane if needed
- Any ZeroClaw-specific operational knowledge must be migrated or documented
