# ADR-002: TypeScript Control Plane (Claude Agent SDK)

**Status:** Accepted
**Date:** 2026-03-09
**Decision makers:** Yann Abadie

## Context
Need a locked-down headless agent runtime. Python SDK lacks `dontAsk` permission mode — model can waste turns discovering tool denials. TypeScript SDK supports `permissionMode: "dontAsk"` with explicit `allowedTools` for hard deny of everything else.

## Decision
TypeScript Agent SDK for the control plane. `dontAsk` + fixed `allowedTools` = smallest possible attack surface. Opus 4.6 for planning/action review, Sonnet 4.6 for routine triage/draft.

## Consequences
### Positive
- Hard security boundary — tools not in `allowedTools` are silently denied, no discovery waste
- Native Zod schema support for type-safe tool definitions
- `dontAsk` permission mode eliminates entire class of prompt-injection escalation

### Negative
- Requires Node.js runtime in the deployment stack
- Team must learn TypeScript (current expertise is Python/PowerShell)
- Tighter coupling to Anthropic SDK release cadence
