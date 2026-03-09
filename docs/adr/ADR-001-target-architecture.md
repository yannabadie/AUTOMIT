# ADR-001: Target Architecture (Hybrid TS+Python with GLPI Plugin)

**Status:** Accepted
**Date:** 2026-03-09
**Decision makers:** Yann Abadie

## Context
AutomIT PoC used ZeroClaw (Rust) + Kestra + prompt-driven curl for IT automation. Audit revealed critical security flaws: SQL injection, exposed secrets, fake approvals, raw HTTP authority. Need a production architecture where LLM proposes and deterministic systems execute.

## Decision
Three-tier architecture — GLPI plugin (PHP, technician UI + rights), TypeScript control plane (Claude Agent SDK, locked-down agent loop), Python tool gateway (FastAPI, deterministic adapters). Kestra kept for orchestration/cron/break-glass only.

## Consequences
### Positive
- Clear separation of concerns, each layer uses its natural language/framework
- Security boundaries enforced at each layer
- LLM never touches infrastructure directly — deterministic adapters mediate all actions

### Negative
- Three languages to maintain (PHP, TS, Python)
- More deployment complexity
- Team must develop and sustain expertise across all three stacks
