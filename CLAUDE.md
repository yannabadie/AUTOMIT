# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AutomIT** is a hybrid IT automation platform for Motherson Aerospace (Serre-Castet, France). It combines:
- **Kestra** — Deterministic workflow orchestration engine (executes, traces, audits)
- **ZeroClaw** — Proactive AI agent in Rust (observes, correlates, decides)
- **Claude Desktop MCP** — Human supervision and control interface

The platform monitors CEGID XRP Sprint, Sage X3, Active Directory, and Microsoft 365 using a three-tier autonomy model:
- **L1**: Pre-approved auto-remediation (e.g., restart failed ERP job)
- **L2**: Agent proposes, human approves via Kestra Pause (e.g., disable compromised AD account)
- **L3**: Agent recommends, human acts (e.g., "increase timeout for recurring failures")

**Status**: PoC phase. Many ERP/AD connections are stubbed with TODOs.

**Priorities**: (1) Real ERP connections replacing TODO stubs, (2) Onboarding/offboarding flow, (3) Microsoft Graph API integration, (4) Grafana dashboard.

## Target Infrastructure

- **Sage X3 (production)**: Accès **exclusivement via MCP x3-oracle** (`MAS_D0Z9TB4:8001`), pas de connexion SQL directe. Token auth `X-MCP-TOKEN`.
- **CEGID XRP Sprint (MSC Maroc)**: `002_srvcgdtest.adgroupe.com:1433` / DB: `Y2_MSC_MAROC` / User: `cegiduser` / ODBC Driver 17. API REST désactivée sur cette VM (`CEGID_API_ENABLED=false`). Knowledge base: DB `CEGID_KB`. Domaine Windows: `MIND`.
- **AD**: Windows Server 2022, DC: `dc01.motherson.local` / Compte service: `ADGROUPE\t1_yaa`
- **M365**: E3 license, tenant: `motherson.onmicrosoft.com`
- **Compliance**: EN9100 (aerospace), sites Serre-Castet + Tanger

### SSL/TLS Workarounds

- **SQL Server (CEGID)**: `TrustServerCertificate=yes` + `Encrypt=yes` (self-signed server cert). Pool recycle 1800s to handle corporate firewall idle timeouts.
- **Docker builds**: Corporate proxy requires injecting CA bundle (`C:\Code\X3-Oracle\docker\ca-bundle.pem`).

## Stack & Operations

All services run via Docker Compose. There is no traditional build/test/lint pipeline.

```bash
# Base stack (Kestra + PostgreSQL + ZeroClaw)
docker compose up -d

# With local LLM (Ollama + GPU)
docker compose --profile local-llm up -d

# With monitoring (Prometheus + Grafana)
docker compose --profile monitoring up -d

# Verify Kestra health
curl -s http://localhost:8080/api/v1/health

# List loaded flows
curl -s http://localhost:8080/api/v1/flows | jq '.[] | .id'

# ZeroClaw status
docker exec motherson-it-automation-zeroclaw-erp-agent-1 zeroclaw status

# Test ERP restart webhook
curl -X POST "http://localhost:8080/api/v1/executions/webhook/motherson.it.erp/erp-job-restart/$(grep WEBHOOK_KEY_ERP_RESTART .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"erp_system":"cegid","job_name":"IMPORT_COMMANDES","failure_count":3}'
```

**Service endpoints**: Kestra UI at `:8080`, Kestra management at `:8081`, Ollama at `:11434`, Prometheus at `:9090`, Grafana at `:3000`.

## Architecture

```
Kestra cron (5min) → erp-health-check → sends report to ZeroClaw gateway
ZeroClaw heartbeat → correlates with SQLite memory → decides L1/L2/L3
  L1 → triggers Kestra flow via webhook (auto-execute)
  L2 → triggers Kestra flow with Pause (awaits human approval)
  L3 → logs recommendation to Teams
```

The key constraint: **ZeroClaw never touches infrastructure directly**. It triggers Kestra flows via HTTP webhooks, and Kestra executes in isolated Docker containers. All commands go through an allowlist/denylist in `config.toml`.

## Key Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Full stack definition with optional `local-llm` and `monitoring` profiles |
| `zeroclaw/config.toml` | ZeroClaw agent config: LLM routing, security allowlist/denylist, heartbeat prompt, tools |
| `zeroclaw/IDENTITY.md` | Agent persona, autonomy levels, operational principles |
| `.env.template` | All required environment variables (webhook keys, credentials, LLM API keys) |
| `kestra/flows/erp-health-check.yml` | Kestra flow: 5-min cron monitoring CEGID/Sage X3 |
| `kestra/flows/erp-job-restart.yml` | Kestra flow: L1 auto-restart of failed ERP jobs (webhook trigger) |
| `kestra/flows/incident-escalation-l2.yml` | Kestra flow: L2 escalation with ticket creation and human approval pause |
| `kestra/flows/ad-maintenance.yml` | Kestra flow: weekly AD audit with optional remediation |
| `scripts/` | Monitoring & remediation scripts (Python/PowerShell), mounted read-only in ZeroClaw |
| `claude_desktop_config.json` | MCP server config for Claude Desktop |
| `.github/*.chatmode.md` | Four Claude Desktop modes: architect, code, ask, debug |
| `memory-bank/` | Project knowledge base (mostly stubs to be filled) |

## Conventions

- **Language**: Documentation and agent prompts in French. Technical terms in English.
- **Flow namespaces**: `motherson.it.erp`, `motherson.it.incidents`, `motherson.it.ad`
- **Webhook URLs**: `/api/v1/executions/webhook/{namespace}/{flow-id}/{key}`
- **Webhook keys**: Generated with `openssl rand -hex 20`, stored in `.env`, one per flow
- **Secrets**: Always in `.env` or Kestra `secret()`, never in YAML flows or config files
- **Scripts**: PowerShell for AD/M365, Python for ERP/monitoring — always Docker-isolated, never native execution in prod
- **ZeroClaw security**: Read-only container, 64MB RAM cap, 0.5 CPU cap, tmpfs for /tmp
- **Ticket IDs**: `INC-YYYYMMDD-{hash}`

## MCP Servers Available

- **x3-oracle**: Sage X3 production — `http://MAS_D0Z9TB4:8001/mcp/` (Neo4j + vector search). Seul point d'accès X3, pas de SQL direct. Ref: `C:\Code\X3-Oracle`
- **cegid-oracle**: CEGID XRP Sprint — `http://10.255.15.200:8000/mcp` (embeddings MiniLM, BM25, Swagger docs). Ref: `C:\Code\CEGID`
- **kestra-mcp**: Kestra flow/execution management from Claude Desktop

## Working on Kestra Flows

Flows are YAML files in `kestra/flows/`, auto-loaded via volume mount to `/app/flows` in Kestra. Each flow follows the pattern:
1. **Trigger**: Cron schedule or webhook
2. **Inputs**: Type-safe with defaults and allowed values
3. **Tasks**: Docker-isolated Python/PowerShell scripts
4. **Outputs**: Structured JSON
5. **Notifications**: Teams webhook on success/failure

Flow IDs use the namespace as prefix in the YAML `id` field (e.g., `erp-job-restart` under namespace `motherson.it.erp`).

## Working on ZeroClaw Config

`zeroclaw/config.toml` controls the agent behavior. Key sections:
- `[model_routing]`: Task-specific LLM selection (analysis/coding/conversation)
- `[security.command_allowlist]`: Commands the agent can execute without human approval
- `[security.command_denylist]`: Commands that are always forbidden
- `[heartbeat]`: The core agent loop prompt that drives L1/L2/L3 decision-making
- `[autonomy]`: Current mode (`readonly` | `supervised` | `autonomous`)

When modifying the allowlist, be conservative — new patterns should be as specific as possible.
