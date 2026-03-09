# AutomIT v2 — GLPI-Integrated ITSM Copilot Design

**Date**: 2026-03-09
**Author**: Yann Abadie + Claude Opus 4.6
**Status**: Approved
**Context**: Comprehensive security/architecture audit of AutomIT PoC revealed 6 critical, 7 high, and 8 medium severity findings. This design defines the target architecture and phased roadmap to transform the PoC into a production-grade ITSM copilot.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Control plane | Hybrid: TypeScript Agent SDK (agent loop) + Python tool gateway (adapters) | TS gives `dontAsk` + `allowedTools` = locked-down headless agent. Python reuses existing ERP/AD/M365 adapters. |
| ZeroClaw | Removed entirely | Control plane TS absorbs heartbeat + correlation + L1/L2/L3 decision. Eliminates nginx proxy, Codex token sync, 0.0.0.0 bind, chatgpt.com/backend-api dependency. |
| Secrets | SOPS + age | Encryption at-rest, versionable. `.sops.yaml` placeholder already exists. No extra infra. |
| Approval model | Dual: GLPI primary (CommonITILValidation) + Kestra Pause break-glass | EN9100 requires traceable + resilient approvals. Normal path via GLPI (real identity in ticket). Break-glass via Kestra with mandatory post-hoc review in GLPI. |
| GLPI | 10.0.14 in prod → plugin targets 11.0.6, REST adapter for 10.x transitional | GLPI 11.0.6 fixes SSTI, XSS, SQL injection, MFA bypass. |
| MVP scope | Phases 0-4 (~8 weeks). Tier 0-1 executable, Tier 2-3 blocked. | Full GLPI integration with read-only analysis + low-risk ticket ops. |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GLPI 11.0.6                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Plugin automit-glpi (PHP)                           │   │
│  │  - Ticket panel (Analyze / Propose / Execute)        │   │
│  │  - Profile rights enforcement (central only)         │   │
│  │  - CommonITILValidation for approvals                │   │
│  │  - CronTask for async reconciliation                 │   │
│  │  - Massive actions (bulk triage)                     │   │
│  └──────────────┬───────────────────────────────────────┘   │
└─────────────────┼───────────────────────────────────────────┘
                  │ Signed request (ticket_id, user_id,
                  │ profile, entity, scope, ticket_hash)
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Control Plane (TypeScript Agent SDK)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Context      │  │ Claude       │  │ Policy Engine     │  │
│  │ Assembler    │→ │ Opus/Sonnet  │→ │ (risk tier,       │  │
│  │ (ticket,     │  │ (analysis,   │  │  rights check,    │  │
│  │  runbooks,   │  │  proposals)  │  │  dual approval)   │  │
│  │  KB, history)│  │              │  │                   │  │
│  └─────────────┘  └──────────────┘  └────────┬──────────┘  │
│                                               │             │
│  allowedTools: fixed list, permissionMode: dontAsk          │
│  Prompt caching: system prompt + policies + schemas         │
└───────────────────────────────────────────────┼─────────────┘
                                                │ Typed action
                                                │ (schema, target_id,
                                                │  idempotency_key, TTL)
                                                ▼
┌─────────────────────────────────────────────────────────────┐
│  Tool Gateway (Python FastAPI)                              │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────┐ ┌────────┐  │
│  │ GLPI     │ │ M365/    │ │ ERP    │ │ AD   │ │ Mail   │  │
│  │ Adapter  │ │ Entra    │ │ (MCP)  │ │      │ │ Graph  │  │
│  └──────────┘ └──────────┘ └────────┘ └──────┘ └────────┘  │
│  - Immutable target IDs only                                │
│  - Pre/post condition checks                                │
│  - Retry + circuit breaker                                  │
│  - Audit receipt generation                                 │
└───────────────────────────────────────────────┬─────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────┐
│  Kestra (Orchestration)                                     │
│  - Long-running workflows (timers, retries, resumable)      │
│  - Cron health checks (ERP, M365, AD)                       │
│  - Break-glass Pause approval (fallback)                    │
│  - Async job execution                                      │
└─────────────────────────────────────────────────────────────┘
```

### Fundamental Principle

The LLM proposes, deterministic systems decide and execute. Requester-authored ticket content is **untrusted** — it feeds analysis, never actions.

### Two Lanes

- **Lane A (answer-only)**: Technician → Analyze → Private/public draft → Technician accepts/edits/rejects
- **Lane B (action)**: Technician → Propose actions → Typed cards (target, risk, rollback) → Technician selects → Policy validates → Approval if required → Tool gateway executes → Receipt in ticket

---

## Action Taxonomy

| Tier | Type | Examples | Approval | GLPI Profile |
|------|------|----------|----------|-------------|
| **0** | Read-only / analysis | Read ticket, summarize, classify, search KB | None | Technician (central) |
| **1** | Reversible ticket ops | Add followup, create task, link asset, categorize | Technician only | Technician (central) |
| **2** | Bounded external actions | Restart ERP job (immutable ID + cooldown), send Graph mail | Technician + policy | Technician + AutomIT-Execute right |
| **3** | Destructive actions | Disable AD user, revoke M365, offboarding, break-glass | Dual approval or break-glass + post-hoc review | Super-Admin or AutomIT-Critical right |

### Typed Action Contract

```typescript
interface ActionContract {
  action_id: string;
  tier: 0 | 1 | 2 | 3;
  target: {
    type: string;        // "erp_job" | "ad_user" | "glpi_ticket"
    id: string;          // Immutable ID, never fuzzy name
    display_name: string;
  };
  idempotency_key: string;
  ttl_seconds: number;
  preconditions: string[];
  postconditions: string[];
  rollback_notes: string;
  justification: string;
  evidence: string[];
  policy_basis: string;
  requestor: {
    glpi_user_id: number;
    profile: string;
    entity: string;
    interface: "central";
  };
  approval?: {
    type: "single" | "dual" | "breakglass";
    approver_ids: number[];
    glpi_validation_id?: number;
  };
  audit_receipt?: {
    timestamp: string;
    result: "success" | "failure" | "partial";
    details: Record<string, unknown>;
    rollback_executed: boolean;
  };
}
```

### Non-Negotiable Rules

1. No fuzzy matching — model proposes name, tool gateway resolves to ID, asks technician for confirmation
2. No action without immutable `target.id`
3. Cooldown registry for ERP restarts (same job_id → 15min minimum)
4. Public responses sanitized — internal hostnames, traces, tokens → private followup only
5. Global emergency stop (outside model reach) — cuts all side-effects, keeps analysis

---

## Monorepo Structure

```
automit/
├── apps/
│   ├── glpi-plugin/              # Native GLPI plugin (PHP 8.1+)
│   │   ├── setup.php
│   │   ├── hook.php
│   │   ├── inc/
│   │   ├── front/
│   │   ├── ajax/
│   │   ├── templates/
│   │   └── locales/
│   └── control-plane/            # TypeScript Agent SDK service
│       ├── src/
│       │   ├── agent.ts
│       │   ├── context-assembler.ts
│       │   ├── policy-engine.ts
│       │   ├── tools/
│       │   ├── routes/
│       │   └── audit.ts
│       ├── package.json
│       └── tsconfig.json
├── services/
│   └── tool-gateway/             # Python FastAPI
│       ├── adapters/
│       │   ├── glpi.py
│       │   ├── erp.py
│       │   ├── ad.py
│       │   ├── m365.py
│       │   └── mail.py
│       ├── registry/
│       │   ├── job_registry.py
│       │   └── cooldown.py
│       ├── middleware/
│       │   ├── auth.py
│       │   └── circuit_breaker.py
│       └── requirements.txt
├── packages/
│   ├── schemas/
│   │   ├── action-contract.ts
│   │   ├── action-contract.json
│   │   ├── ticket-context.ts
│   │   └── audit-receipt.ts
│   └── policies/
│       ├── tier-definitions.yml
│       ├── cooldown-rules.yml
│       └── redaction-rules.yml
├── specs/
│   └── tla/
│       ├── TicketActionFSM.tla
│       ├── ApprovalFSM.tla
│       ├── IdempotencyFSM.tla
│       └── BreakglassReviewFSM.tla
├── evals/
│   ├── datasets/
│   ├── red-team/
│   └── harness.ts
├── kestra/
│   └── flows/                    # Hardened flows
├── infra/
│   ├── docker-compose.yml
│   ├── Dockerfile.control-plane
│   ├── Dockerfile.tool-gateway
│   ├── .env.encrypted
│   ├── .sops.yaml
│   └── prometheus.yml
├── docs/
│   ├── adr/
│   ├── plans/
│   ├── threat-model.md
│   └── runbooks/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── release.yml
│   └── *.chatmode.md
├── .claude/
│   ├── settings.json
│   └── skills/
├── CLAUDE.md
└── .gitignore
```

### Tech Stack

| Component | Tech | Justification |
|-----------|------|---------------|
| GLPI Plugin | PHP 8.1+, Twig | Native GLPI hooks/rights |
| Control Plane | TypeScript, `@anthropic-ai/claude-agent-sdk` | `dontAsk` + `allowedTools` = locked surface |
| Tool Gateway | Python 3.12, FastAPI | Reuses existing adapters, ODBC, pyodbc |
| Shared Schemas | JSON Schema + Zod | Cross-language validation |
| Orchestration | Kestra OSS | Cron, retries, long workflows, break-glass Pause |
| Monitoring | Prometheus + Grafana + Loki | Kept, images pinned |
| Secrets | SOPS + age | Encryption at-rest, versionable |
| CI | GitHub Actions | Secret scan, CodeQL, SBOM, Cosign, tests |

---

## Phased Roadmap (8 Weeks)

### Phase 0 — Stop the Bleeding (Days 1-3)

| # | Action | Detail |
|---|--------|--------|
| 0.1 | Purge secrets from repo | `git filter-repo` to remove `.env`, `claude_desktop_config.json` from history. Rotate ALL exposed credentials. |
| 0.2 | Configure SOPS + age | Generate age keypair, configure `.sops.yaml`, create `.env.encrypted`, update `.gitignore`. |
| 0.3 | Pin Docker images | Replace 8 `latest` tags with SHA256 digests. Remove `pull_policy: always`. |
| 0.4 | Close network binds | Remove ZeroClaw (0.0.0.0 bind). Restrict Kestra UI to `127.0.0.1:8080`. Remove port 18080. |
| 0.5 | Unique webhook keys per flow | 1 key per flow in `.env.encrypted`, replace shared m365-audit key. |
| 0.6 | Minimal security CI | GitHub Actions: `trufflehog` (secret scan), `trivy` (image scan), push protection. |

**Exit gate**: Zero secrets in repo (history + working tree), no public unauthenticated binds, CI blocks secret pushes.

### Phase 1 — Monorepo & Foundations (Weeks 1-2)

| # | Action | Detail |
|---|--------|--------|
| 1.1 | Restructure to monorepo | Create `apps/`, `services/`, `packages/`, `specs/`, `evals/`, `infra/`, `docs/adr/`. Remove `zeroclaw/`, `terraform/`, `scripts/sync-codex-tokens.py`. |
| 1.2 | Write founding ADRs | ADR-001 Target architecture, ADR-002 TS control plane, ADR-003 SOPS+age, ADR-004 Dual approval, ADR-005 ZeroClaw removal. |
| 1.3 | Shared schemas | `packages/schemas/`: ActionContract (Zod + JSON Schema), TicketContext, AuditReceipt. |
| 1.4 | Fix existing Kestra flows | Parameterize SQL, add `allowedValues`/regex on inputs, fix ad-maintenance output-path bug, add Graph pagination in m365-audit, replace `http://kestra:8080` with env var. |
| 1.5 | Extended CI | TS: `pnpm lint`, `pnpm typecheck`, `pnpm test`. Python: `ruff`, `pytest`, `pip-audit`. YAML: `yamllint`. CodeQL. SBOM via `syft`. |
| 1.6 | Dockerfiles | control-plane (Node 22 LTS, minimal, non-root) + tool-gateway (Python 3.12, ODBC, corporate CA, non-root). |

**Exit gate**: Monorepo structured, schemas compile, Kestra flows fixed (safe SQL, validated inputs), CI green.

### Phase 2 — GLPI Plugin (Weeks 2-4)

| # | Action | Detail |
|---|--------|--------|
| 2.1 | Plugin scaffold | `setup.php`, `hook.php`, tables, rights, configs. Target GLPI 11.0.6, REST adapter for 10.x. |
| 2.2 | Rights & profiles | `plugin_automit_use` (analysis/draft) + `plugin_automit_execute` (Tier 1-2) + `plugin_automit_critical` (Tier 3). Central only. |
| 2.3 | Ticket panel (Lane A) | Tab on ticket: "Analyze" / "Propose response". AJAX → control plane. Draft display with citations. Accept/edit/reject → GLPI followup. |
| 2.4 | Action cards (Lane B) | "Propose actions" button. Cards: target, tier, justification, preconditions, rollback. Technician selects → signed request. |
| 2.5 | CommonITILValidation | Tier 2-3: create GLPI validation (approver = 2nd technician). Callback to control plane on validate/reject. |
| 2.6 | Async CronTask | Reconciliation: poll control plane for long actions, write receipts to ticket timeline. |
| 2.7 | GLPI 10→11 migration doc | Preprod 11.0.6, copy `glpicrypt.key`, `php bin/console database:update`, test plugin. |

**Exit gate**: Technician in GLPI central can analyze ticket, see cited draft, and see action proposals as cards. Helpdesk/requester sees nothing.

### Phase 3 — TypeScript Control Plane (Weeks 3-6)

| # | Action | Detail |
|---|--------|--------|
| 3.1 | Agent loop | `@anthropic-ai/claude-agent-sdk`, `permissionMode: "dontAsk"`, fixed `allowedTools`. Opus 4.6 for planning, Sonnet 4.6 for triage/draft. |
| 3.2 | Context assembler | Ticket + KB + runbooks → prompt. Prompt caching on system prompt + policies + schemas. |
| 3.3 | Policy engine | Validate ActionContract: tier vs GLPI rights, cooldown registry, fuzzy→ID resolution, dual approval, redaction. |
| 3.4 | HTTP routes | `POST /analyze`, `POST /propose`, `POST /execute`, `GET /status/:action_id`, `POST /breakglass`. Signed request auth. |
| 3.5 | Audit trail | Receipt per action → PostgreSQL + GLPI private followup. |
| 3.6 | Emergency stop | `/kill` endpoint (outside model reach): global flag cuts all side-effects, keeps analysis. |

**Exit gate**: Control plane receives signed request, assembles context, calls Claude, returns cited draft OR typed action proposals with policy validation. `dontAsk` blocks unlisted tools.

### Phase 4 — Tool Gateway & Tier 0-1 Actions (Weeks 5-8)

| # | Action | Detail |
|---|--------|--------|
| 4.1 | GLPI adapter | `glpi_get_ticket_context`, `glpi_add_private_followup`, `glpi_add_public_followup`, `glpi_create_task`, `glpi_set_solution`, `glpi_link_asset`. |
| 4.2 | ERP adapter (MCP) | Job registry: `display_name → { job_id, erp_system, tier, cooldown_min }`. Read-only MCP queries with parameterized SQL. |
| 4.3 | M365/Graph adapter | Full `@odata.nextLink` pagination, `Retry-After` on 429, batch requests. |
| 4.4 | Circuit breaker | Per-adapter: 5 failures → open (60s) → half-open → closed. Prometheus metrics. |
| 4.5 | Auth middleware | HMAC signature verification on control plane → tool gateway requests. |
| 4.6 | End-to-end integration | Full Lane A + Lane B Tier 0-1 loop tested. |

**Exit gate**: Complete Lane A + Lane B Tier 0-1 loop functional. Tier 2-3 visible but blocked by policy.

### Future Phases (Post-MVP, Months 3-6)

| Phase | Content | Prerequisite |
|-------|---------|-------------|
| **5** | Tier 2-3 governance: ERP restart, AD disable, M365 revoke. Dual approval. Break-glass + post-hoc review. | Phase 4 complete |
| **6** | TLA+ specs: TicketActionFSM, ApprovalFSM, IdempotencyFSM, BreakglassReviewFSM. Model checking in CI. | Phase 5 stable |
| **7** | Evals: replay harness on historical tickets, red-team prompt injection, shadow mode metrics. | Phase 6 green |
| **8** | Beyond: massive actions, technician macros, runbook-backed explanations, entity-aware KB, multilingual. | Phase 7 metrics OK |

---

## Audit Findings Addressed

| Finding | Severity | Fix Phase |
|---------|----------|-----------|
| Secrets in git (15+ credentials) | CRITICAL | Phase 0 (purge + SOPS) |
| SQL injection in erp-job-restart | CRITICAL | Phase 1 (parameterized SQL) |
| Mutable Docker image tags | CRITICAL | Phase 0 (pin digests) |
| ZeroClaw 0.0.0.0 bind + OTP disabled | CRITICAL | Phase 0 (remove ZeroClaw) |
| Shared/exposed webhook keys | CRITICAL | Phase 0 (unique keys, SOPS) |
| Approval bypass (immediate_disable) | CRITICAL | Phase 2-3 (separate action types) |
| Kestra basic auth defaults | HIGH | Phase 0 (rotate) + Phase 3 (token auth) |
| No input validation on flows | HIGH | Phase 1 (allowedValues, regex) |
| SOPS placeholder unused | HIGH | Phase 0 (configure) |
| Docker-in-Docker via docker.sock | HIGH | Phase 1 (rootless Docker) |
| No Graph API pagination | HIGH | Phase 1 (nextLink + throttling) |
| Fake ITSM tickets | HIGH | Phase 2-4 (real GLPI integration) |
| Hardcoded approver identity | HIGH | Phase 2-3 (GLPI user identity) |
| ZeroClaw supervised mode | MEDIUM | Phase 0 (remove ZeroClaw) |
| No circuit breaker | MEDIUM | Phase 4 (per-adapter) |
| Internal Docker links in Teams | MEDIUM | Phase 1 (env var URL) |
| ad-maintenance output bug | MEDIUM | Phase 1 (fix path) |
| Doc drift | MEDIUM | Phase 1 (update README) |
| Shallow CI | MEDIUM | Phase 1 (extended CI) |
| No audit trail | MEDIUM | Phase 3 (receipts) |
