# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**AutomIT** is a production-grade IT automation platform for Motherson Aerospace (Serre-Castet, France). It follows a **three-tier architecture**:

1. **GLPI Plugin** (PHP) — User interface embedded in GLPI ticket view (Lane A: analyze/draft, Lane B: action cards)
2. **Control Plane** (TypeScript) — Claude Agent SDK with policy engine, HMAC auth, audit trail, emergency stop
3. **Tool Gateway** (Python/FastAPI) — Adapters for GLPI, ERP (CEGID/X3 via MCP), M365 (Graph API), with circuit breaker and cooldown
4. **Kestra** — Deterministic workflow orchestration (cron + webhook triggers, Docker-isolated execution)

The platform monitors CEGID XRP Sprint, Sage X3, Active Directory, and Microsoft 365 using a **four-tier action taxonomy**:
- **Tier 0**: Read-only (ticket context, ERP status) — no approval
- **Tier 1**: Reversible ticket ops (add followup, change status) — auto-approved
- **Tier 2**: Bounded external (restart ERP job, disable AD account) — GLPI validation required
- **Tier 3**: Destructive (delete account, purge data) — dual approval (GLPI + Kestra break-glass)

**Status**: v2 scaffold complete. PoC flows operational. Control plane and tool gateway scaffolded (Claude Agent SDK integration pending).

## Architecture

```
GLPI Ticket View (PHP plugin)
  │  HMAC-signed HTTP
  ▼
Control Plane (:3001, TypeScript/Express)
  │  Claude Agent SDK (permissionMode: "dontAsk" + allowedTools)
  │  Policy engine (tier validation, cooldowns, emergency stop)
  │  Audit trail (receipt per action)
  │  HMAC-signed HTTP
  ▼
Tool Gateway (:3002, Python/FastAPI)
  ├── GLPI adapter (REST API, session-based auth)
  ├── ERP adapter (CEGID MCP + X3 MCP, job registry)
  ├── M365 adapter (Graph API, pagination + throttling)
  ├── Circuit breaker (5 failures → 60s open)
  └── Cooldown registry (per action+target rate limiting)
  │
  ▼
Kestra (:8080, workflow orchestration)
  ├── erp-health-check (cron 5min)
  ├── erp-job-restart (webhook, allowlisted jobs)
  ├── ad-onboarding / ad-offboarding (L2, 4-eyes)
  ├── m365-audit (weekly + webhook)
  └── incident-escalation-l2 (ticket + pause)
```

## Monorepo Structure

```
AutomIT/
├── apps/
│   ├── control-plane/        # TypeScript Express + Claude Agent SDK
│   └── glpi-plugin/          # PHP GLPI 10.0.14+ plugin
├── services/
│   └── tool-gateway/         # Python FastAPI + adapters
├── packages/
│   ├── schemas/              # Shared Zod schemas (ActionContract, TicketContext, AuditReceipt)
│   └── policies/             # YAML policy files (tiers, cooldowns, redaction)
├── kestra/
│   └── flows/                # 8 Kestra YAML workflows
├── infra/
│   ├── docker-compose.yml    # Full stack (Kestra, Postgres, control-plane, tool-gateway, monitoring)
│   ├── Dockerfile.*          # Container images
│   ├── .sops.yaml            # SOPS+age encryption config
│   └── grafana/, prometheus.yml, loki/
├── docs/
│   ├── adr/                  # Architecture Decision Records (ADR-001 through ADR-005)
│   ├── plans/                # Design docs and implementation plans
│   └── runbooks/             # Operational runbooks
├── evals/                    # E2E test scripts
├── scripts/                  # Utility scripts (connectivity tests, etc.)
├── .github/workflows/        # CI: trufflehog, trivy, CodeQL, typecheck, ruff
├── .env.template             # All env vars (copy to .env, fill values)
└── CLAUDE.md                 # This file
```

## Stack & Operations

```bash
# Start full stack
docker compose -f infra/docker-compose.yml up -d

# With monitoring (Prometheus + Grafana + Loki)
docker compose -f infra/docker-compose.yml --profile monitoring up -d

# With local LLM (Ollama + GPU)
docker compose -f infra/docker-compose.yml --profile local-llm up -d

# Health checks
curl -s http://localhost:8080/api/v1/health          # Kestra
curl -s http://localhost:3001/health                  # Control Plane
curl -s http://localhost:3002/health                  # Tool Gateway

# E2E smoke test
bash evals/e2e-test.sh
```

**Service endpoints** (all bound to `127.0.0.1`):

| Service | Port | Purpose |
|---------|------|---------|
| Kestra UI | 8080 | Workflow management |
| Kestra mgmt | 8081 | Management API |
| Control Plane | 3001 | Agent SDK + policy engine |
| Tool Gateway | 3002 | GLPI/ERP/M365 adapters |
| Prometheus | 9090 | Metrics (monitoring profile) |
| Grafana | 3000 | Dashboards (monitoring profile) |
| Ollama | 11434 | Local LLM (local-llm profile) |

## Target Infrastructure

- **Sage X3**: Access **exclusively via MCP x3-oracle** (`MAS_D0Z9TB4:8001`). No direct SQL.
- **CEGID XRP Sprint**: Access **exclusively via MCP cegid-oracle** (`10.255.15.200:8000`). 20 MCP tools. No direct SQL (port 1433 not accessible).
- **AD**: Windows Server 2022, DC: `dc01.motherson.local`
- **M365**: E3, tenant: `adigroupe.onmicrosoft.com`. Entra ID App Registration required.
- **GLPI**: v10.0.14 (migration to 11.0.6 planned). REST API + plugin.
- **Compliance**: EN9100 (aerospace), sites Serre-Castet + Tanger

### SSL/TLS

- **CEGID SQL Server**: `TrustServerCertificate=yes` + `Encrypt=yes` (self-signed cert)
- **Docker builds**: Corporate proxy requires CA bundle injection (`infra/ca-bundle.pem`)

## Conventions

- **Language**: Documentation in French, technical terms in English
- **Flow namespaces**: `motherson.it.erp`, `motherson.it.incidents`, `motherson.it.ad`, `motherson.it.m365`
- **Webhook keys**: `openssl rand -hex 20`, stored in `.env`, one per flow
- **Secrets**: SOPS+age for encryption at rest. Never in YAML or code. Use `.env` + Kestra `secret()`
- **Auth**: HMAC-SHA256 signatures between all tiers (GLPI → Control Plane → Tool Gateway)
- **Docker images**: Pinned to specific version tags (e.g., `kestra/kestra:v0.21.1`)
- **Ticket IDs**: `INC-YYYYMMDD-{hash}`

## Key ADRs

| ADR | Decision |
|-----|----------|
| ADR-001 | Three-tier architecture (GLPI → Control Plane → Tool Gateway → Kestra) |
| ADR-002 | TypeScript control plane with Claude Agent SDK (`dontAsk` + `allowedTools`) |
| ADR-003 | SOPS+age for secret encryption at rest |
| ADR-004 | Dual approval: GLPI CommonITILValidation (primary) + Kestra Pause (break-glass) |
| ADR-005 | ZeroClaw removed — control plane absorbs its responsibilities |

## Working on Kestra Flows

Flows are YAML files in `kestra/flows/`, auto-loaded via volume mount. Each flow follows:
1. **Trigger**: Cron schedule or webhook (unique key per flow)
2. **Inputs**: Type-safe with defaults and allowed values (SELECT for allowlisted inputs)
3. **Tasks**: Docker-isolated Python/PowerShell using `automit/python-erp:3.12` image
4. **Outputs**: Structured JSON
5. **Notifications**: Teams webhook + Graph API email (double canal)

**Important**: All ERP access goes through MCP servers, never direct SQL. Job names validated against allowlist (SELECT input + regex + exact-match DB verification).

## Working on the Control Plane

TypeScript Express server (`apps/control-plane/`). Key modules:
- `middleware/auth.ts`: HMAC signature verification + timestamp freshness (5min window)
- `policy-engine.ts`: Tier validation, cooldowns, emergency stop, immutable target IDs
- `context-assembler.ts`: Fetches GLPI ticket context from tool gateway
- `audit.ts`: Receipt creation per action (UUID-based)
- `routes/`: analyze, propose, execute, status, kill

Claude Agent SDK integration uses `permissionMode: "dontAsk"` + explicit `allowedTools` for locked-down headless agent.

## Working on the Tool Gateway

Python FastAPI (`services/tool-gateway/`). Key modules:
- `adapters/glpi.py`: GLPI REST API (session-based auth, ticket context + followup)
- `adapters/erp.py`: ERP via MCP (job registry, regex validation, Tier 2 blocked by default)
- `adapters/m365.py`: Graph API with `@odata.nextLink` pagination + `Retry-After` throttling
- `middleware/auth.py`: HMAC verification on all endpoints except `/health`
- `middleware/circuit_breaker.py`: Per-adapter circuit breaker (closed → open → half-open)
- `registry/cooldown.py`: Per action+target rate limiting
- `registry/job_registry.yml`: Allowlisted CEGID jobs with tier and cooldown

## MCP Servers Available

- **x3-oracle**: Sage X3 — `http://MAS_D0Z9TB4:8001/mcp/` (Neo4j + vector search)
- **cegid-oracle**: CEGID XRP Sprint — `http://10.255.15.200:8000/mcp` (20 tools)
- **kestra-mcp**: Kestra flow/execution management from Claude Desktop

## Email Notifications (Graph API Mail.Send)

- **Sender**: `automit-noreply@adigroupe.onmicrosoft.com` (shared mailbox)
- **Recipients**: manager + IT team (`M365_IT_TEAM_EMAIL`)
- **Format**: HTML tables
- **Fallback**: Teams webhook if Entra ID credentials absent

## Security

- All Docker images pinned to specific versions (no `:latest`)
- All ports bound to `127.0.0.1`
- HMAC-SHA256 authentication between all tiers
- SOPS+age for secret encryption at rest
- CI: TruffleHog (secret scan), Trivy (image scan), CodeQL (Python + JS)
- Emergency stop via `/kill` endpoint (admin token required)
- Docker socket mount documented as known risk (roadmap: rootless Docker)
