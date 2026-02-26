# Phase 1 — Corrections et Complements Manquants

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up the AutomIT PoC: fill memory-bank stubs, sync README roadmap, add missing env vars, Docker healthchecks, extract shared MCP/Graph client, and add CI validation.

**Architecture:** Six independent cleanup tasks that bring the repo from "PoC that works" to "PoC ready for team handoff". No new features — only documentation, deduplication, and CI guardrails.

**Tech Stack:** YAML (Kestra flows), Python (shared lib), Docker Compose, GitHub Actions, yamllint

---

### Task 1: Memory-Bank — Fill all stubs with real project content

**Files:**
- Modify: `memory-bank/productContext.md`
- Modify: `memory-bank/activeContext.md`
- Modify: `memory-bank/progress.md`
- Modify: `memory-bank/projectBrief.md`
- Modify: `memory-bank/systemPatterns.md`
- Modify: `memory-bank/decisionLog.md`
- Modify: `memory-bank/architect.md`

**Step 1: Write `productContext.md`**

```markdown
# Product Context

## What is AutomIT?
AutomIT is a hybrid IT automation platform for Motherson Aerospace (Serre-Castet, France).
It combines three components:
- **Kestra** — Deterministic workflow orchestration engine (executes, traces, audits)
- **ZeroClaw** — Proactive AI agent in Rust (observes, correlates, decides)
- **Claude Desktop MCP** — Human supervision and control interface

## What problems does it solve?
- Manual monitoring of CEGID XRP Sprint, Sage X3, Active Directory, and Microsoft 365
- Slow incident response (failed ERP jobs, compromised accounts, license waste)
- No audit trail for IT operations (EN9100 compliance gap)
- Onboarding/offboarding takes days of manual provisioning across 4+ systems

## Three-tier autonomy model
- **L1**: Pre-approved auto-remediation (e.g., restart failed ERP job)
- **L2**: Agent proposes, human approves via Kestra Pause (e.g., disable compromised AD account)
- **L3**: Agent recommends, human acts (e.g., "increase timeout for recurring failures")

## Target systems
| System | Access Method | Purpose |
|--------|--------------|---------|
| CEGID XRP Sprint | MCP cegid-oracle (10.255.15.200:8000) | Manufacturing ERP (MSC Maroc) |
| Sage X3 | MCP x3-oracle (MAS_D0Z9TB4:8001) | Production ERP |
| Active Directory | PowerShell (ADGROUPE domain) | Identity management |
| Microsoft 365 | Graph API (Entra ID) | Collaboration + security |

## Compliance
- EN9100 (aerospace quality): 4-eyes principle via Kestra Pause, audit trail, segregation of duties
- Sites: Serre-Castet (France) + Tanger (Morocco)
```

**Step 2: Write `activeContext.md`**

```markdown
# Active Context

## Current Status
**PoC complet** — All 5 priorities implemented and committed.

## What was just completed
1. ERP connections migrated to MCP servers (cegid-oracle + x3-oracle) — no direct SQL
2. Onboarding/offboarding flows (AD + M365 + ERP provisioning, L2 4-eyes)
3. Microsoft Graph API integration (service health, licenses, MFA, risky users)
4. Grafana monitoring dashboard (Prometheus + Pushgateway, 18 panels)
5. Email notifications via Graph API Mail.Send (4 flows)

## What's next
- **Immediate**: Entra ID App Registration (RSSI approval pending) to activate Graph API
- **Immediate**: AD service account delegation (OU permissions, DC connectivity)
- **Phase 2**: Production deployment on target VM (002_srvcgdtest.adgroupe.com)
- **Phase 2**: ZeroClaw agent pilot in L3 mode (observation + recommendation only)
- **Phase 2**: Replace stubbed ad-maintenance.yml with real PowerShell cmdlets

## Current blockers
- `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` empty — waiting RSSI approval
- `AD_DC` empty — need DC FQDN from infra team
- ActiveDirectory PowerShell module not available in Linux Docker containers
```

**Step 3: Write `progress.md`**

```markdown
# Progress

## Completed
- [x] **Priority 1**: Real ERP connections via MCP (cegid-oracle + x3-oracle)
- [x] **Priority 2**: Onboarding/offboarding flows (AD + M365 + ERP, L2 4-eyes)
- [x] **Priority 3**: Microsoft Graph API integration (health, licenses, security)
- [x] **Priority 4**: Grafana monitoring dashboard (Prometheus + Pushgateway)
- [x] **Priority 5**: Email notifications via Graph API Mail.Send
- [x] Docker stack (Kestra + PostgreSQL + ZeroClaw + nginx proxy)
- [x] ZeroClaw OAuth authentication (Codex CLI tokens via ChaCha20-Poly1305)
- [x] Custom Docker image automit/python-erp:3.12 (ODBC 17, corporate CA)
- [x] Connectivity tests (8/8 PASS: CEGID MCP + Sage X3 MCP)
- [x] Corporate proxy workaround (nginx sidecar for ZeroClaw TLS)

## Pending
- [ ] Entra ID App Registration (RSSI approval)
- [ ] AD service account delegation on OUs
- [ ] AD DC connectivity from Docker
- [ ] ActiveDirectory PowerShell module in containers
- [ ] ad-maintenance.yml: replace stub with real cmdlets
- [ ] Production deployment on target VM
- [ ] ZeroClaw L3 pilot
```

**Step 4: Write `projectBrief.md`**

```markdown
# Project Brief

## Purpose
Automate IT operations for Motherson Aerospace using a hybrid approach:
deterministic workflows (Kestra) for execution, AI agent (ZeroClaw) for observation
and decision-making, human supervision (Claude Desktop MCP) for approval.

## Target Users
- **IT Operations team** (Serre-Castet) — daily monitoring, incident response
- **Solutions Architect** (Yann Abadie) — platform design, agent tuning
- **RSSI** — compliance oversight, permission approval

## Stack
| Component | Technology | Role |
|-----------|-----------|------|
| Orchestration | Kestra (Docker) | Flow execution, audit trail, cron, webhooks |
| AI Agent | ZeroClaw v0.1.7 (Rust) | Observation, correlation, L1/L2/L3 decisions |
| LLM | GPT-5.3-Codex (via ChatGPT Pro) | Agent reasoning (Gemini/Ollama fallbacks) |
| Supervision | Claude Desktop MCP | Human approval, flow management |
| ERP Access | MCP servers (cegid-oracle, x3-oracle) | Read-only SQL, job management |
| Identity | Active Directory + Entra ID | User lifecycle, security |
| Monitoring | Prometheus + Grafana | Metrics, dashboards |
| Notifications | Teams webhooks + Graph API email | Alerts, reports |

## Endpoints
| Service | URL |
|---------|-----|
| Kestra UI | http://localhost:8080 |
| Kestra mgmt | http://localhost:8081 |
| ZeroClaw gateway | http://localhost:42617 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3000 |
| CEGID MCP | http://10.255.15.200:8000/mcp |
| Sage X3 MCP | http://MAS_D0Z9TB4:8001/mcp/ |
```

**Step 5: Write `systemPatterns.md`**

```markdown
# System Patterns

## Architectural Patterns

### Kestra-as-Executor / ZeroClaw-as-Brain
ZeroClaw observes and decides, but NEVER touches infrastructure directly.
All actions go through Kestra flows via HTTP webhooks.
Kestra provides the audit trail, Docker isolation, and human approval gates.

### MCP-Only ERP Access
All ERP access (CEGID, Sage X3) goes exclusively through MCP servers.
No direct SQL connections from Kestra or ZeroClaw. Benefits:
- Single point of access control (token auth)
- Read-only by default (query_database tool)
- Knowledge base integration (search_knowledge, explore_schema)

### Webhook Coupling
ZeroClaw triggers Kestra flows via HTTP POST to webhook endpoints.
Each flow has a unique webhook key (openssl rand -hex 20) stored in .env.
Pattern: `POST /api/v1/executions/webhook/{namespace}/{flow-id}/{key}`

### Docker Isolation
Every Kestra task runs in an isolated Docker container (sibling container via Docker socket).
Custom image `automit/python-erp:3.12` includes ODBC Driver 17, corporate CA, kestra SDK.
PowerShell tasks use `mcr.microsoft.com/powershell:latest`.

### L2 Pause (4-Eyes)
For sensitive operations (onboarding, offboarding, remediation), Kestra Pause task
blocks execution until a human validates in the UI. Timeout: 24-48h.
Compliant with EN9100 4-eyes principle.

## Notification Pattern
All flows send Teams webhook notifications. Flows with email capability also send
HTML emails via Graph API Mail.Send from `automit-noreply@adigroupe.onmicrosoft.com`.
Graceful fallback: if Entra ID credentials are missing, only Teams is used.

## Security Pattern
- ZeroClaw: read-only container, 64MB RAM cap, 0.5 CPU, tmpfs /tmp, allowlist/denylist
- Kestra: basic auth, per-flow webhook keys, Docker-isolated execution
- Secrets: always in .env or Kestra secret(), never in YAML
- ERP: MCP token auth (X-MCP-TOKEN header), read-only queries
```

**Step 6: Write `decisionLog.md`**

```markdown
# Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-23 | ZeroClaw over OpenClaw | ZeroClaw is a single Rust binary (3.4MB), supports Codex OAuth, embeds SQLite memory. OpenClaw is Python-based, heavier, and less suited for constrained Docker environments. |
| 2026-02-23 | Kestra over Temporal/Airflow | Kestra has native YAML flows, Docker-isolated execution, webhook triggers, Pause for human approval, and a built-in UI. No JVM/Python runtime needed for flow definitions. |
| 2026-02-24 | Codex OAuth via nginx sidecar | ZeroClaw uses rustls+webpki-roots which rejects corporate MITM certificates (UnknownIssuer). Solution: nginx sidecar proxy with corporate CA in system store. ZeroClaw calls http://openai-proxy → nginx terminates TLS → chatgpt.com. |
| 2026-02-24 | MCP-only for ERP access | Direct SQL from Docker to CEGID (port 1433) is blocked by corporate firewall. MCP cegid-oracle (10.255.15.200:8000) provides read-only access via JSON-RPC. Same pattern for Sage X3 via x3-oracle. |
| 2026-02-25 | Kestra Pause for 4-eyes | EN9100 compliance requires segregation of duties. Kestra Pause task blocks flow execution until human validates via UI. Used for all L2 operations (onboarding, offboarding, remediation). |
| 2026-02-25 | Graph API Mail.Send + Application Access Policy | Mail.Send permission allows sending as any user. Restricted to a dedicated shared mailbox (automit-noreply) via Exchange Online Application Access Policy. No license needed for shared mailbox. |
| 2026-02-25 | Entra ID rename (Azure AD) | Microsoft renamed Azure AD to Entra ID in 2023. Endpoints unchanged (login.microsoftonline.com, graph.microsoft.com). Updated all references in codebase. |
```

**Step 7: Write `architect.md`**

```markdown
# Architect Notes

## Architecture Overview
```
Claude Desktop (MCP) ──→ Kestra (orchestration)
                              ↕
ZeroClaw (AI agent) ──webhook──→ Kestra flows
                              ↕
                    Infrastructure (AD, M365, CEGID, X3)
```

## Key Constraints
1. ZeroClaw never touches infrastructure directly (always via Kestra webhooks)
2. ERP access exclusively via MCP servers (no direct SQL)
3. All sensitive operations require human approval (L2 Pause)
4. Docker isolation for all task execution
5. Corporate MITM proxy requires CA bundle injection

## Container Architecture
- Kestra manages Docker socket → spawns sibling containers for tasks
- automit/python-erp:3.12 = base image for all Python tasks
- mcr.microsoft.com/powershell:latest = base for AD tasks (Linux, needs RSAT workaround)
- nginx:alpine = TLS termination sidecar for ZeroClaw → OpenAI

## Open Questions
- AD PowerShell in Linux containers: Windows container, PSRemoting, or Python ldap3?
- ServiceNow/GLPI integration: REST API or email-to-ticket?
- Multi-site monitoring: single Kestra instance or federated?
```

**Step 8: Commit**

```bash
git add memory-bank/
git commit -m "docs: fill memory-bank with real project knowledge"
```

---

### Task 2: README.md — Sync roadmap with actual status

**Files:**
- Modify: `README.md:27-29` (architecture diagram — update TODO labels)
- Modify: `README.md:124-141` (project structure — add missing files)
- Modify: `README.md:169-192` (roadmap — sync with CLAUDE.md)

**Step 1: Update the architecture diagram**

Replace lines 27-28 in `README.md`:
```
    │ • onboarding (TODO)  │  │  • Trigger flows Kestra        │
    │ • m365-audit (TODO)  │  │  • Notification Teams          │
```
With:
```
    │ • ad-onboarding      │  │  • Trigger flows Kestra        │
    │ • ad-offboarding     │  │  • Notification Teams + email  │
    │ • m365-audit         │  │                                │
```

**Step 2: Update the project structure**

Replace lines 124-141 with:
```markdown
## Structure du projet

```
motherson-it-automation/
├── docker-compose.yml              # Stack complète (base + local-llm + monitoring)
├── .env.template                   # Variables d'environnement
├── kestra/
│   └── flows/
│       ├── erp-health-check.yml        # Surveillance ERP (cron 5min)
│       ├── erp-job-restart.yml         # Relance jobs ERP (webhook L1)
│       ├── incident-escalation-l2.yml  # Escalade incidents (L2)
│       ├── ad-maintenance.yml          # Nettoyage AD (hebdo + webhook)
│       ├── ad-onboarding.yml           # Onboarding IT (L2, 4-eyes)
│       ├── ad-offboarding.yml          # Offboarding IT (L2, 4-eyes)
│       └── m365-audit.yml             # Audit M365 (hebdo + webhook)
├── zeroclaw/
│   ├── config.toml                 # Configuration agent
│   ├── IDENTITY.md                 # Persona agent IT
│   ├── openai-proxy.conf           # nginx reverse proxy config
│   └── ca-bundle.pem               # Corporate CA bundle
├── scripts/
│   ├── lib/
│   │   ├── __init__.py
│   │   └── mcp_client.py           # Shared MCP + Graph API client
│   ├── docker/
│   │   ├── Dockerfile.python-erp   # Custom Python image (ODBC 17 + CA)
│   │   └── requirements-erp.txt
│   ├── erp/
│   │   └── test_connectivity.py    # MCP connectivity tests (8 tests)
│   └── sync-codex-tokens.py        # Token sync Codex CLI → ZeroClaw
├── docs/
│   ├── prometheus.yml              # Prometheus scraping config
│   ├── grafana/                    # Grafana provisioning + dashboards
│   └── plans/                      # Implementation plans
└── memory-bank/                    # Project knowledge base
```
```

**Step 3: Replace the roadmap**

Replace lines 169-192 with:
```markdown
## Roadmap PoC → Production

### Phase 1 — PoC (2 semaines) ✅
- [x] Architecture Kestra + ZeroClaw
- [x] Flows ERP monitoring
- [x] Agent config + identity
- [x] Connexion reelle CEGID (via MCP cegid-oracle)
- [x] Connexion reelle Sage X3 (via MCP x3-oracle)
- [x] Onboarding/offboarding flows (L2, 4-eyes EN9100)
- [x] Microsoft Graph API integration (health, licences, securite)
- [x] Grafana dashboard (Prometheus + Pushgateway, 18 panels)
- [x] Email notifications via Graph API Mail.Send

### Phase 2 — Pilote (1 mois)
- [ ] Entra ID App Registration (RSSI approval)
- [ ] Connexion AD reelle (PowerShell AD module + delegation OUs)
- [ ] Deploiement sur VM cible (002_srvcgdtest.adgroupe.com)
- [ ] Agent ZeroClaw en mode L3 (observation + recommandation)
- [ ] Test end-to-end sur environnement de dev
- [ ] ad-maintenance.yml avec cmdlets reelles (remplacer stubs)

### Phase 3 — Production (2 mois)
- [ ] Activation progressive L1 (actions pre-approuvees)
- [ ] Integration ServiceNow/GLPI
- [ ] Agent multicanal (Teams + Slack)
- [ ] Audit trail conformite EN9100
- [ ] Documentation operationnelle
- [ ] Formation equipe IT
```

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: sync README roadmap and structure with actual PoC status"
```

---

### Task 3: .env.template — Add missing variables

**Files:**
- Modify: `.env.template`

**Step 1: Add ZeroClaw host home, MCP servers, and AD variables**

After the existing ZeroClaw section (line 22), add:
```bash
# --- ZeroClaw Host Home (path to ~/.zeroclaw on Windows host) ---
ZEROCLAW_HOST_HOME=C:/Users/yann.abadie/.zeroclaw
```

After the Teams section (line ~50), add:
```bash
# --- MCP Servers ---
# CEGID Oracle (JSON-RPC, 20 tools incl. query_database)
MCP_CEGID_ORACLE_URL=http://10.255.15.200:8000/mcp
MCP_CEGID_ORACLE_TOKEN=
# Sage X3 Oracle (Neo4j + vector search)
X3_MCP_URL=http://MAS_D0Z9TB4:8001/mcp/
X3_MCP_TOKEN=
```

After the MCP Servers section, add:
```bash
# --- Active Directory ---
AD_DOMAIN=ADGROUPE
AD_DC=
AD_SERVICE_ACCOUNT=ADGROUPE\svc_automit
AD_SERVICE_PASSWORD=
```

Also remove the old ERP direct connection section (CEGID_DB_HOST, X3_DB_HOST etc.) since all access is via MCP now.

**Step 2: Verify all secrets referenced in flows exist in template**

Run:
```bash
cd /c/Code/AutomIT && grep -hro "secret('[^']*')" kestra/flows/*.yml | sort -u | sed "s/secret('//;s/')//" > /tmp/flow_secrets.txt && cat /tmp/flow_secrets.txt
```

Cross-check each secret name exists in `.env.template`. Add any missing ones.

**Step 3: Commit**

```bash
git add .env.template
git commit -m "chore: add missing env vars (MCP servers, AD, ZeroClaw host home)"
```

---

### Task 4: Docker healthchecks — Add to openai-proxy and zeroclaw

**Files:**
- Modify: `docker-compose.yml:87-98` (openai-proxy service)
- Modify: `docker-compose.yml:106-142` (zeroclaw-erp-agent service)

**Step 1: Add healthcheck to openai-proxy**

After line 98 (`restart: unless-stopped`), before the zeroclaw section, add inside the openai-proxy service:
```yaml
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:80/"]
      interval: 30s
      timeout: 5s
      retries: 3
```

**Step 2: Add healthcheck to zeroclaw-erp-agent**

After `cpus: 0.5` (line 142), add inside the zeroclaw-erp-agent service:
```yaml
    healthcheck:
      test: ["CMD", "zeroclaw", "status"]
      interval: 60s
      timeout: 10s
      retries: 3
```

**Step 3: Validate compose file**

Run:
```bash
cd /c/Code/AutomIT && docker compose config --quiet && echo "PASS" || echo "FAIL"
```

Expected: `PASS` (no errors)

**Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add Docker healthchecks for openai-proxy and zeroclaw"
```

---

### Task 5: Extract shared MCP/Graph client library

**Files:**
- Create: `scripts/lib/__init__.py`
- Create: `scripts/lib/mcp_client.py`
- Modify: `scripts/docker/Dockerfile.python-erp` (COPY lib into image)
- Modify: `kestra/flows/erp-health-check.yml` (import instead of inline)
- Modify: `kestra/flows/erp-job-restart.yml` (import instead of inline)
- Modify: `kestra/flows/ad-onboarding.yml` (import instead of inline)
- Modify: `kestra/flows/ad-offboarding.yml` (import instead of inline)
- Modify: `kestra/flows/m365-audit.yml` (import instead of inline)
- Modify: `kestra/flows/incident-escalation-l2.yml` (import instead of inline)

**Step 1: Create `scripts/lib/__init__.py`**

```python
```

(empty file)

**Step 2: Create `scripts/lib/mcp_client.py`**

```python
"""Shared MCP client and Graph API utilities for Kestra flows."""

import json
import requests
from typing import Any


def mcp_call(mcp_url: str, mcp_token: str, tool_name: str, arguments: dict, timeout: int = 30) -> Any:
    """Call an MCP tool via JSON-RPC."""
    headers = {
        "X-MCP-TOKEN": mcp_token,
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    payload = {
        "jsonrpc": "2.0", "id": 1,
        "method": "tools/call",
        "params": {"name": tool_name, "arguments": arguments}
    }
    resp = requests.post(mcp_url, json=payload, headers=headers, timeout=timeout)
    if resp.status_code == 200:
        data = resp.json()
        if "error" in data:
            raise Exception(f"MCP error: {data['error']}")
        return data.get("result", data)
    raise Exception(f"HTTP {resp.status_code}: {resp.text[:300]}")


def mcp_query(mcp_url: str, mcp_token: str, sql: str, limit: int = 100) -> Any:
    """Execute a read-only SQL query via MCP query_database tool."""
    return mcp_call(mcp_url, mcp_token, "query_database", {"sql": sql, "limit": limit})


def parse_mcp_query_result(result: Any) -> list:
    """Extract rows from MCP query_database response."""
    if isinstance(result, dict) and "content" in result:
        for item in result["content"]:
            if item.get("type") == "text":
                data = json.loads(item["text"]) if isinstance(item["text"], str) else item["text"]
                if isinstance(data, dict) and "rows" in data:
                    return data["rows"]
                elif isinstance(data, list):
                    return data
                return [data]
    return []


def get_graph_token(tenant: str, client_id: str, client_secret: str) -> str:
    """Obtain a Microsoft Graph API access token via client_credentials flow."""
    resp = requests.post(
        f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials"
        }, timeout=30
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def send_graph_email(access_token: str, service_mailbox: str, subject: str,
                     html_body: str, recipients: list[str]) -> bool:
    """Send an email via Graph API Mail.Send. Returns True if sent (HTTP 202)."""
    to_list = [{"emailAddress": {"address": addr}} for addr in recipients if addr]
    resp = requests.post(
        f"https://graph.microsoft.com/v1.0/users/{service_mailbox}/sendMail",
        headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
        json={
            "message": {
                "subject": subject,
                "body": {"contentType": "HTML", "content": html_body},
                "toRecipients": to_list
            },
            "saveToSentItems": "true"
        }, timeout=30
    )
    return resp.status_code == 202
```

**Step 3: Update Dockerfile to include the lib**

Add after `COPY scripts/docker/requirements-erp.txt` line in `scripts/docker/Dockerfile.python-erp`:
```dockerfile
# Install shared library
COPY scripts/lib /opt/automit/lib
ENV PYTHONPATH="/opt/automit:${PYTHONPATH}"
```

**Step 4: Rebuild the Docker image**

Run:
```bash
cd /c/Code/AutomIT && docker build -t automit/python-erp:3.12 -f scripts/docker/Dockerfile.python-erp .
```

**Step 5: Refactor each flow — replace inline `mcp_call` with import**

For each flow that defines `mcp_call` inline, replace the function definition block with:
```python
from lib.mcp_client import mcp_call, mcp_query, parse_mcp_query_result
```

For each flow that has inline Graph token fetch, replace with:
```python
from lib.mcp_client import get_graph_token
access_token = get_graph_token(tenant, client_id, client_secret)
```

For each flow that has inline email sending, replace with:
```python
from lib.mcp_client import get_graph_token, send_graph_email
access_token = get_graph_token(tenant, client_id, client_secret)
sent = send_graph_email(access_token, service_mailbox, subject, html_body, [manager_email, it_email])
```

**Flows to refactor** (6 occurrences of `mcp_call`, 9 occurrences of token fetch):

| Flow | Replace | With |
|------|---------|------|
| `erp-health-check.yml:56-74` | `def mcp_call` + `def mcp_query` | `from lib.mcp_client import mcp_call, mcp_query` |
| `erp-health-check.yml:336-346` | inline token fetch | `from lib.mcp_client import get_graph_token` |
| `erp-job-restart.yml:98-129` | `def mcp_call` + `def parse_mcp_query_result` | `from lib.mcp_client import mcp_call, parse_mcp_query_result` |
| `erp-job-restart.yml:230-248` | `def mcp_call` (duplicate) | `from lib.mcp_client import mcp_call` |
| `erp-job-restart.yml:316-347` | `def mcp_call` + `def parse_mcp_query_result` (duplicate) | `from lib.mcp_client import mcp_call, parse_mcp_query_result` |
| `ad-onboarding.yml:509-522` | `def mcp_call` | `from lib.mcp_client import mcp_call` |
| `ad-onboarding.yml:427+654` | 2x inline token fetch | `from lib.mcp_client import get_graph_token` |
| `ad-offboarding.yml:483-496` | `def mcp_call` | `from lib.mcp_client import mcp_call` |
| `ad-offboarding.yml:405+611` | 2x inline token fetch | `from lib.mcp_client import get_graph_token` |
| `m365-audit.yml:74+573+684` | 3x inline token fetch | `from lib.mcp_client import get_graph_token` |
| `incident-escalation-l2.yml:231` | 1x inline token fetch | `from lib.mcp_client import get_graph_token` |

**Step 6: Run connectivity tests to verify nothing broke**

```bash
cd /c/Code/AutomIT && python scripts/erp/test_connectivity.py
```

Expected: 8/8 PASS

**Step 7: Commit**

```bash
git add scripts/lib/ scripts/docker/Dockerfile.python-erp kestra/flows/
git commit -m "refactor: extract shared MCP client + Graph API helpers into scripts/lib/"
```

---

### Task 6: GitHub Actions CI — YAML validation workflow

**Files:**
- Create: `.github/workflows/validate.yml`

**Step 1: Create the workflow**

```yaml
name: Validate

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install yamllint
        run: pip install yamllint

      - name: Lint Kestra flows (YAML)
        run: |
          yamllint -d "{extends: relaxed, rules: {line-length: {max: 300}, truthy: disable}}" kestra/flows/*.yml

      - name: Validate docker-compose
        run: docker compose config --quiet

      - name: Check env template completeness
        run: |
          echo "Checking all secrets referenced in flows exist in .env.template..."
          MISSING=0
          for secret in $(grep -hro "secret('[^']*')" kestra/flows/*.yml | sort -u | sed "s/secret('//;s/')//"); do
            if ! grep -q "^${secret}=" .env.template && ! grep -q "^#.*${secret}" .env.template; then
              echo "MISSING: $secret (referenced in flows but not in .env.template)"
              MISSING=$((MISSING + 1))
            fi
          done
          if [ $MISSING -gt 0 ]; then
            echo "ERROR: $MISSING secrets missing from .env.template"
            exit 1
          fi
          echo "All secrets accounted for in .env.template"

      - name: Validate Python library syntax
        run: python -c "import ast; ast.parse(open('scripts/lib/mcp_client.py').read()); print('OK')"
```

**Step 2: Test locally**

```bash
cd /c/Code/AutomIT
# Test yamllint
pip install yamllint
yamllint -d "{extends: relaxed, rules: {line-length: {max: 300}, truthy: disable}}" kestra/flows/*.yml

# Test env completeness check
for secret in $(grep -hro "secret('[^']*')" kestra/flows/*.yml | sort -u | sed "s/secret('//;s/')//"); do
  grep -q "^${secret}=" .env.template || echo "MISSING: $secret"
done
```

**Step 3: Commit**

```bash
git add .github/workflows/validate.yml
git commit -m "ci: add GitHub Actions workflow for YAML lint + env template validation"
```

---

## Execution Order

Tasks 1-4 are independent and can be parallelized.
Task 5 (shared lib) should run after Tasks 1-4 are committed (it touches flows).
Task 6 (CI) should run last (validates everything).

```
Task 1 (memory-bank) ─┐
Task 2 (README)       ─┤
Task 3 (.env.template) ┼──→ Task 5 (shared lib) ──→ Task 6 (CI)
Task 4 (healthchecks) ─┘
```
