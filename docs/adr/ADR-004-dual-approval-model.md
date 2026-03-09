# ADR-004: Dual Approval Model (GLPI + Kestra Break-Glass)

**Status:** Accepted
**Date:** 2026-03-09
**Decision makers:** Yann Abadie

## Context
EN9100 aerospace compliance requires traceable and resilient approval chains. Current system has `approved_by = "human_operator"` (hardcoded string) and `immediate_disable` flag that bypasses approval entirely.

## Decision
Primary approvals via GLPI CommonITILValidation (real identity, in ticket timeline). Break-glass fallback via Kestra Pause when GLPI is unavailable, with mandatory post-hoc review item created in GLPI. Separate action types for normal vs emergency (no boolean bypass flags).

## Consequences
### Positive
- Traceable — every approval tied to a real GLPI identity
- Resilient — Kestra fallback ensures operations continue during GLPI outage
- Auditable — both paths write receipts, enabling post-hoc review
- EN9100 compliant — approval chain is documented and verifiable

### Negative
- Two approval paths to test and verify in CI/CD and acceptance testing
- More complex workflow logic to handle path selection and fallback
- Post-hoc review process must be enforced organizationally, not just technically
