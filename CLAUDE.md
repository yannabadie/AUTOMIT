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

**Status**: PoC complet — les 4 priorites sont implementees. AD PowerShell et Azure credentials restent a configurer en prod.

**Priorities**: (1) ~~Real ERP connections~~ DONE, (2) ~~Onboarding/offboarding flow~~ DONE, (3) ~~Microsoft Graph API integration~~ DONE, (4) ~~Grafana dashboard~~ DONE.

## Target Infrastructure

- **Sage X3 (production)**: Accès **exclusivement via MCP x3-oracle** (`MAS_D0Z9TB4:8001`), pas de connexion SQL directe. Token auth `X-MCP-TOKEN`.
- **CEGID XRP Sprint (MSC Maroc)**: Accès **exclusivement via MCP cegid-oracle** (`10.255.15.200:8000`). 20 outils MCP dont `query_database` (SQL read-only), `analyze_data_freshness`, `database_overview`. Token auth `X-MCP-TOKEN`. DB: `Y2_MSC_MAROC`. API REST désactivée (`CEGID_API_ENABLED=false`). Knowledge base: DB `CEGID_KB`. Domaine Windows: `MIND`. **Pas de connexion SQL directe** (port 1433 non accessible depuis Docker/réseau local).
- **AD**: Windows Server 2022, DC: `dc01.motherson.local` / Compte service: `ADGROUPE\t1_yaa`
- **M365**: E3 license, tenant: `adigroupe.onmicrosoft.com`
- **Compliance**: EN9100 (aerospace), sites Serre-Castet + Tanger

### SSL/TLS Workarounds

- **SQL Server (CEGID)**: `TrustServerCertificate=yes` + `Encrypt=yes` (self-signed server cert). Pool recycle 1800s to handle corporate firewall idle timeouts.
- **Docker builds**: Corporate proxy requires injecting CA bundle (`C:\Code\X3-Oracle\docker\ca-bundle.pem`).
- **ZeroClaw → OpenAI**: rustls+webpki-roots rejects corporate MITM cert (`UnknownIssuer`). Solved via nginx sidecar proxy (`openai-proxy` service) with `ca-bundle.pem` in system CA store. ZeroClaw calls `http://openai-proxy/backend-api/codex` → nginx proxies to `https://chatgpt.com/backend-api/codex`. Endpoint is `/backend-api/codex/responses` (NOT `/v1/responses`).

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
| `zeroclaw/openai-proxy.conf` | nginx reverse proxy: routes `/backend-api/` → `chatgpt.com`, `/oauth/` → `auth.openai.com` |
| `zeroclaw/ca-bundle.pem` | Corporate MITM CA bundle for nginx proxy TLS verification |
| `zeroclaw/IDENTITY.md` | Agent persona, autonomy levels, operational principles |
| `.env.template` | All required environment variables (webhook keys, credentials, LLM API keys) |
| `kestra/flows/erp-health-check.yml` | Kestra flow: 5-min cron monitoring CEGID/Sage X3 |
| `kestra/flows/erp-job-restart.yml` | Kestra flow: L1 auto-restart of failed ERP jobs (webhook trigger) |
| `kestra/flows/incident-escalation-l2.yml` | Kestra flow: L2 escalation with ticket creation and human approval pause |
| `kestra/flows/ad-maintenance.yml` | Kestra flow: weekly AD audit with optional remediation |
| `kestra/flows/ad-onboarding.yml` | Kestra flow: L2 onboarding — AD + M365 + ERP provisioning |
| `kestra/flows/ad-offboarding.yml` | Kestra flow: L2 offboarding — disable AD, revoke M365, revoke ERP |
| `kestra/flows/m365-audit.yml` | Kestra flow: weekly M365 audit — licences, MFA, risky users, sign-ins |
| `docs/prometheus.yml` | Prometheus scraping config (Kestra + Pushgateway) |
| `docs/grafana/dashboards/automit-overview.json` | Grafana dashboard: ERP health, M365, Kestra executions |
| `docs/grafana/provisioning/` | Grafana auto-provisioning: datasource + dashboard provider |
| `scripts/erp/test_connectivity.py` | Connectivity test: CEGID MCP + Sage X3 MCP (8 tests) |
| `scripts/docker/Dockerfile.python-erp` | Custom Docker image: python:3.12-slim + ODBC 17 + corporate CA |
| `scripts/sync-codex-tokens.py` | Token sync from Codex CLI to ZeroClaw (ChaCha20-Poly1305) |
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
- **cegid-oracle**: CEGID XRP Sprint — `http://10.255.15.200:8000/mcp` (20 tools: `query_database`, `analyze_data_freshness`, `database_overview`, `search_knowledge`, `explore_schema`, etc.). Seul point d'accès CEGID (port 1433 non accessible). Token: `X-MCP-TOKEN`. Ref: `C:\Code\CEGID`
- **kestra-mcp**: Kestra flow/execution management from Claude Desktop

## Working on Kestra Flows

Flows are YAML files in `kestra/flows/`, auto-loaded via volume mount to `/app/flows` in Kestra. Each flow follows the pattern:
1. **Trigger**: Cron schedule or webhook
2. **Inputs**: Type-safe with defaults and allowed values
3. **Tasks**: Docker-isolated Python/PowerShell scripts using `automit/python-erp:3.12` (includes ODBC 17, corporate CA, pyodbc, requests, kestra SDK)
4. **Outputs**: Structured JSON
5. **Notifications**: Teams webhook on success/failure

**Important**: All ERP access goes through MCP servers, never direct SQL. CEGID uses `query_database` tool for read queries and `sp_start_job` for job restarts. Sage X3 uses `batch_status`/`batch_restart` tools.

Flow IDs use the namespace as prefix in the YAML `id` field (e.g., `erp-job-restart` under namespace `motherson.it.erp`).

## Working on ZeroClaw Config

**Version**: v0.1.7 (2026-02-24) — `debian:trixie-slim` (GLIBC 2.41)

**LLM Provider**: `openai-codex` — OAuth via abonnement ChatGPT Pro (zero coût API supplémentaire). Modèle: `gpt-5.3-codex`.

**API Endpoint**: `chatgpt.com/backend-api/codex/responses` (NOT `api.openai.com/v1/responses`). Le Codex CLI et ZeroClaw utilisent l'endpoint backend ChatGPT, pas l'API Platform. Les tokens OIDC (`openid profile email offline_access`) suffisent — pas besoin de scopes API type `api.responses.write`.

**Auth architecture**: ZeroClaw (rustls+webpki-roots) ne peut pas traverser le proxy corporate MITM. Solution: sidecar nginx (`openai-proxy`) qui termine le TLS avec le CA store système (incluant `ca-bundle.pem`).

```
ZeroClaw (HTTP) → nginx sidecar → HTTPS → chatgpt.com/backend-api/codex/responses
                                 → HTTPS → auth.openai.com/oauth/* (token refresh)
```

**Auth initiale** — tokens partagés depuis le Codex CLI host:
```bash
# 1. S'authentifier via Codex CLI sur le host Windows (utilise SChannel, passe le proxy)
codex  # ou: npx @openai/codex  — lance le flow OAuth navigateur

# 2. Chiffrer les tokens Codex CLI dans auth-profiles.json ZeroClaw
python3 scripts/sync-codex-tokens.py  # ChaCha20-Poly1305, clé .secret_key

# 3. Vérifier
docker exec automit-zeroclaw-erp-agent-1 zeroclaw auth status
docker exec automit-zeroclaw-erp-agent-1 zeroclaw agent -m "Dis bonjour"
```

Token persisté dans `~/.zeroclaw/auth-profiles.json` (chiffré ChaCha20-Poly1305, clé dans `.secret_key`). Fallbacks configurés: Gemini 2.5 Flash (free tier), Ollama (local).

**Embeddings**: `snowflake-arctic-embed2` via Ollama (local, multilingue FR/EN). Nécessite `--profile local-llm`.

`zeroclaw/config.toml` controls the agent behavior. Key sections:
- `[model_routing]`: Task-specific LLM selection (analysis/coding/conversation)
- `[security.command_allowlist]`: Commands the agent can execute without human approval
- `[security.command_denylist]`: Commands that are always forbidden
- `[heartbeat]`: The core agent loop prompt that drives L1/L2/L3 decision-making
- `[autonomy]`: Current mode (`readonly` | `supervised` | `autonomous`)

When modifying the allowlist, be conservative — new patterns should be as specific as possible.
