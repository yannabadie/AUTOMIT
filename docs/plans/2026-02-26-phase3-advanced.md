# Phase 3 — Ameliorations Avancees

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evolve AutomIT from PoC to production-ready with Kestra subflows, SLAs, Terraform GitOps, KV Store state, ZeroClaw version pinning, Loki log aggregation, and secrets management.

**Architecture:** Seven tasks spanning observability (Loki), modularity (subflows), reliability (SLAs, version pinning), infrastructure-as-code (Terraform), statefulness (KV Store), and security (secrets encryption). Each is independent except Task 7 (secrets) which should run last.

**Tech Stack:** Kestra (subflows, SLAs, KV Store), Terraform (kestra provider), Grafana Loki, SOPS/age (secrets encryption), Docker Compose

---

### Task 1: Kestra Subflows for Graph API Token and MCP Health Check

**Files:**
- Create: `kestra/flows/_common/graph-api-token.yml`
- Create: `kestra/flows/_common/mcp-health-check.yml`
- Modify: `kestra/flows/m365-audit.yml` (replace inline token task with subflow call)
- Modify: `kestra/flows/erp-health-check.yml` (replace MCP check with subflow call)

**Step 1: Create the Graph API token subflow**

Create `kestra/flows/_common/graph-api-token.yml`:

```yaml
# =============================================================================
# SUBFLOW: Graph API Token — Reusable authentication
# Called by: m365-audit, ad-onboarding, ad-offboarding, incident-escalation, selftest
# Returns: access_token (string) or error
# =============================================================================
id: graph-api-token
namespace: motherson.it.common

description: |
  Subflow reutilisable pour obtenir un token Graph API via client_credentials.
  Appele par tous les flows qui interagissent avec Microsoft Graph.

inputs:
  - id: tenant_id
    type: STRING
    required: true
  - id: client_id
    type: STRING
    required: true
  - id: client_secret
    type: STRING
    required: true

tasks:
  - id: get_token
    type: io.kestra.plugin.scripts.python.Script
    taskRunner:
      type: io.kestra.plugin.scripts.runner.docker.Docker
      containerImage: automit/python-erp:3.12
    script: |
      import json
      import requests
      from lib.logging import log_info, log_error

      tenant = "{{ inputs.tenant_id }}"
      client_id = "{{ inputs.client_id }}"
      client_secret = "{{ inputs.client_secret }}"

      try:
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
          token = resp.json()["access_token"]
          expires_in = resp.json().get("expires_in", 3600)
          log_info("Graph API token obtained", expires_in=expires_in)

          from kestra import Kestra
          Kestra.outputs({"access_token": token, "authenticated": True})
      except Exception as e:
          log_error("Graph API auth failed", error=str(e))
          from kestra import Kestra
          Kestra.outputs({"access_token": "", "authenticated": False, "error": str(e)})

outputs:
  - id: access_token
    type: STRING
    value: "{{ outputs.get_token.vars.access_token }}"
  - id: authenticated
    type: BOOLEAN
    value: "{{ outputs.get_token.vars.authenticated }}"
```

**Step 2: Create the MCP health check subflow**

Create `kestra/flows/_common/mcp-health-check.yml`:

```yaml
# =============================================================================
# SUBFLOW: MCP Server Health Check — Reusable connectivity test
# Called by: erp-health-check, automit-selftest
# Returns: status (OK/FAIL), response_time_ms, details
# =============================================================================
id: mcp-health-check
namespace: motherson.it.common

description: |
  Subflow reutilisable pour tester la connectivite d'un serveur MCP.
  Appelle l'outil database_overview et mesure le temps de reponse.

inputs:
  - id: mcp_url
    type: STRING
    required: true
  - id: mcp_token
    type: STRING
    required: true
  - id: server_name
    type: STRING
    required: true
    description: "Nom du serveur (cegid, sage_x3) pour le logging"

tasks:
  - id: check_connectivity
    type: io.kestra.plugin.scripts.python.Script
    taskRunner:
      type: io.kestra.plugin.scripts.runner.docker.Docker
      containerImage: automit/python-erp:3.12
    script: |
      import json
      import time
      from lib.mcp_client import mcp_call
      from lib.logging import log_info, log_error

      mcp_url = "{{ inputs.mcp_url }}"
      mcp_token = "{{ inputs.mcp_token }}"
      server = "{{ inputs.server_name }}"

      result = {"server": server, "status": "FAIL", "response_time_ms": -1}

      try:
          start = time.time()
          resp = mcp_call(mcp_url, mcp_token, "database_overview", {})
          elapsed = round((time.time() - start) * 1000)
          result["status"] = "OK"
          result["response_time_ms"] = elapsed
          log_info(f"MCP {server} OK", server=server, response_time_ms=elapsed)
      except Exception as e:
          result["error"] = str(e)[:200]
          log_error(f"MCP {server} FAIL", server=server, error=str(e)[:200])

      from kestra import Kestra
      Kestra.outputs(result)

outputs:
  - id: status
    type: STRING
    value: "{{ outputs.check_connectivity.vars.status }}"
  - id: response_time_ms
    type: INT
    value: "{{ outputs.check_connectivity.vars.response_time_ms }}"
```

**Step 3: Example caller — update m365-audit.yml to use graph-api-token subflow**

Replace the `get_graph_token` task in `m365-audit.yml` with:

```yaml
  - id: get_graph_token
    type: io.kestra.plugin.core.flow.Subflow
    namespace: motherson.it.common
    flowId: graph-api-token
    inputs:
      tenant_id: "{{ secret('AZURE_TENANT_ID') }}"
      client_id: "{{ secret('AZURE_CLIENT_ID') }}"
      client_secret: "{{ secret('AZURE_CLIENT_SECRET') }}"
    wait: true
    transmitFailed: true
```

Then update downstream references from `{{ outputs.get_graph_token.vars.token }}` to `{{ outputs.get_graph_token.outputs.access_token }}`.

**Note:** Migrating ALL callers at once is risky. Start with m365-audit only, then migrate others incrementally.

**Step 4: Validate YAML**

```bash
python -c "
import yaml
for f in ['kestra/flows/_common/graph-api-token.yml', 'kestra/flows/_common/mcp-health-check.yml', 'kestra/flows/m365-audit.yml']:
    yaml.safe_load(open(f)); print(f'{f}: OK')
"
```

**Step 5: Commit**

```bash
git add kestra/flows/_common/ kestra/flows/m365-audit.yml
git commit -m "feat: add Kestra subflows for Graph API token and MCP health check"
```

---

### Task 2: Kestra SLAs on Critical Flows

**Files:**
- Modify: `kestra/flows/erp-health-check.yml` (add SLA)
- Modify: `kestra/flows/erp-job-restart.yml` (add SLA)
- Modify: `kestra/flows/ad-onboarding.yml` (add SLA)
- Modify: `kestra/flows/ad-offboarding.yml` (add SLA)
- Modify: `kestra/flows/m365-audit.yml` (add SLA)

**Step 1: Add SLA blocks to each flow**

Add after the `labels:` block and before `tasks:` in each flow:

For `erp-health-check.yml` (runs every 5min, must be fast):
```yaml
sla:
  - id: max_execution_time
    type: MAX_DURATION
    duration: PT5M
    behavior: CANCEL
```

For `erp-job-restart.yml` (urgent remediation):
```yaml
sla:
  - id: max_execution_time
    type: MAX_DURATION
    duration: PT10M
    behavior: CANCEL
```

For `ad-onboarding.yml` (includes L2 pause, longer timeout):
```yaml
sla:
  - id: max_execution_time
    type: MAX_DURATION
    duration: PT72H
    behavior: CANCEL
```

For `ad-offboarding.yml` (includes L2 pause):
```yaml
sla:
  - id: max_execution_time
    type: MAX_DURATION
    duration: PT48H
    behavior: CANCEL
```

For `m365-audit.yml` (weekly audit, may include remediation pause):
```yaml
sla:
  - id: max_execution_time
    type: MAX_DURATION
    duration: PT48H
    behavior: CANCEL
```

**Step 2: Validate YAML**

```bash
python -c "
import yaml
flows = ['erp-health-check','erp-job-restart','ad-onboarding','ad-offboarding','m365-audit']
for f in flows:
    yaml.safe_load(open(f'kestra/flows/{f}.yml')); print(f'{f}: OK')
"
```

**Step 3: Commit**

```bash
git add kestra/flows/erp-health-check.yml kestra/flows/erp-job-restart.yml kestra/flows/ad-onboarding.yml kestra/flows/ad-offboarding.yml kestra/flows/m365-audit.yml
git commit -m "feat: add Kestra SLAs (MAX_DURATION) on all critical flows"
```

---

### Task 3: Terraform Provider for GitOps Deployment

**Files:**
- Create: `terraform/main.tf`
- Create: `terraform/variables.tf`
- Create: `terraform/flows.tf`
- Create: `terraform/.gitignore`

**Step 1: Create `terraform/.gitignore`**

```
.terraform/
*.tfstate
*.tfstate.backup
*.tfplan
.terraform.lock.hcl
```

**Step 2: Create `terraform/variables.tf`**

```hcl
variable "kestra_url" {
  description = "Kestra API URL"
  type        = string
  default     = "http://localhost:8080"
}

variable "kestra_username" {
  description = "Kestra basic auth username"
  type        = string
  default     = "yann.abadie@motherson-mas.com"
}

variable "kestra_password" {
  description = "Kestra basic auth password"
  type        = string
  sensitive   = true
}
```

**Step 3: Create `terraform/main.tf`**

```hcl
terraform {
  required_providers {
    kestra = {
      source  = "kestra-io/kestra"
      version = "~> 0.18"
    }
  }
}

provider "kestra" {
  url      = var.kestra_url
  username = var.kestra_username
  password = var.kestra_password
}
```

**Step 4: Create `terraform/flows.tf`**

```hcl
# Deploy all Kestra flows from YAML files via Terraform
# This replaces the volume mount approach (./kestra/flows:/app/flows)
# and provides proper state management + GitOps workflow.

resource "kestra_flow" "flows" {
  for_each             = fileset("${path.module}/../kestra/flows", "**/*.yml")
  keep_original_source = true
  flow_id              = yamldecode(file("${path.module}/../kestra/flows/${each.value}"))["id"]
  namespace            = yamldecode(file("${path.module}/../kestra/flows/${each.value}"))["namespace"]
  content              = file("${path.module}/../kestra/flows/${each.value}")
}
```

**Step 5: Commit**

```bash
git add terraform/
git commit -m "feat: add Terraform provider for Kestra GitOps deployment"
```

---

### Task 4: Kestra KV Store for Shared State

**Files:**
- Modify: `kestra/flows/erp-health-check.yml` (store last health status + consecutive failure count)
- Modify: `kestra/flows/erp-job-restart.yml` (check last restart time to avoid storm)

**Step 1: Add KV write to erp-health-check.yml**

Add a new task after `aggregate_and_forward`, before the triggers section:

```yaml
  - id: update_kv_state
    type: io.kestra.plugin.core.flow.Sequential
    tasks:
      - id: set_last_check
        type: io.kestra.plugin.kv.Set
        key: erp_last_health_check
        value: "{{ outputs.aggregate_and_forward.vars.report_json }}"
        namespace: motherson.it.erp
        overwrite: true

      - id: set_cegid_status
        type: io.kestra.plugin.kv.Set
        key: erp_cegid_status
        value: "{{ outputs.check_cegid.vars.status }}"
        namespace: motherson.it.erp
        overwrite: true

      - id: set_check_timestamp
        type: io.kestra.plugin.kv.Set
        key: erp_last_check_ts
        value: "{{ now() }}"
        namespace: motherson.it.erp
        overwrite: true
```

**Step 2: Add KV read to erp-job-restart.yml (anti-storm guard)**

Add as the first task in erp-job-restart.yml, before `check_job_status`:

```yaml
  - id: check_restart_cooldown
    type: io.kestra.plugin.scripts.python.Script
    taskRunner:
      type: io.kestra.plugin.scripts.runner.docker.Docker
      containerImage: automit/python-erp:3.12
    script: |
      from datetime import datetime, timezone, timedelta
      from lib.logging import log_info, log_warn

      last_restart = "{{ kv('erp_last_restart_ts', namespace='motherson.it.erp', errorOnMissing=false) }}"

      if last_restart and last_restart != "null":
          try:
              last_dt = datetime.fromisoformat(last_restart.replace("Z", "+00:00"))
              now = datetime.now(timezone.utc)
              cooldown = timedelta(minutes=10)
              if now - last_dt < cooldown:
                  remaining = cooldown - (now - last_dt)
                  log_warn("Restart cooldown active", last_restart=last_restart, remaining_s=remaining.total_seconds())
                  from kestra import Kestra
                  Kestra.outputs({"cooldown_active": True, "can_restart": False})
                  import sys; sys.exit(0)
          except Exception:
              pass

      log_info("No cooldown — restart allowed")
      from kestra import Kestra
      Kestra.outputs({"cooldown_active": False, "can_restart": True})
```

And add a KV write at the end of erp-job-restart.yml (after restart succeeds):

```yaml
  - id: set_restart_timestamp
    type: io.kestra.plugin.kv.Set
    key: erp_last_restart_ts
    value: "{{ now() }}"
    namespace: motherson.it.erp
    overwrite: true
```

**Step 3: Commit**

```bash
git add kestra/flows/erp-health-check.yml kestra/flows/erp-job-restart.yml
git commit -m "feat: use Kestra KV Store for health check state and restart cooldown"
```

---

### Task 5: ZeroClaw Version Pinning + Smoke Test

**Files:**
- Modify: `zeroclaw/Dockerfile` (strict version pin + checksum)
- Create: `scripts/zeroclaw/smoke-test.sh`
- Modify: `docker-compose.yml` (add smoke test as healthcheck alternative)

**Step 1: Update Dockerfile with stricter pinning**

The Dockerfile already has `ARG ZEROCLAW_VERSION=0.1.7`. Add a SHA256 checksum verification after the download step. In `zeroclaw/Dockerfile`, after the `curl` download line, add:

```dockerfile
# Verify binary integrity (update hash when upgrading)
ARG ZEROCLAW_SHA256="UPDATE_WITH_ACTUAL_SHA256_ON_UPGRADE"
RUN if [ "$ZEROCLAW_SHA256" != "UPDATE_WITH_ACTUAL_SHA256_ON_UPGRADE" ]; then \
      echo "$ZEROCLAW_SHA256  /tmp/zeroclaw.tar.gz" | sha256sum -c -; \
    fi
```

**Step 2: Create smoke test script**

Create `scripts/zeroclaw/smoke-test.sh`:

```bash
#!/bin/bash
# ZeroClaw post-upgrade smoke test
# Run after upgrading the ZeroClaw binary version
# Usage: docker exec automit-zeroclaw-erp-agent-1 /opt/scripts/zeroclaw/smoke-test.sh

set -e

echo "=== ZeroClaw Smoke Test ==="

# 1. Version check
echo -n "Version: "
zeroclaw --version || { echo "FAIL: zeroclaw --version"; exit 1; }

# 2. Config validation
echo -n "Config: "
zeroclaw config validate 2>/dev/null && echo "OK" || { echo "FAIL: config validate"; exit 1; }

# 3. Auth status
echo -n "Auth: "
zeroclaw auth status 2>/dev/null && echo "OK" || echo "WARN: auth not configured (expected in fresh deploy)"

# 4. Status check
echo -n "Status: "
zeroclaw status 2>/dev/null && echo "OK" || { echo "FAIL: zeroclaw status"; exit 1; }

echo "=== Smoke Test PASSED ==="
```

**Step 3: Commit**

```bash
chmod +x scripts/zeroclaw/smoke-test.sh
git add zeroclaw/Dockerfile scripts/zeroclaw/smoke-test.sh
git commit -m "chore: add ZeroClaw version pinning + post-upgrade smoke test"
```

---

### Task 6: Loki Log Aggregation Stack

**Files:**
- Create: `docs/loki/loki-config.yml`
- Create: `docs/grafana/provisioning/datasources/loki.yml`
- Modify: `docker-compose.yml` (add loki service + docker log driver)

**Step 1: Create Loki config**

Create `docs/loki/loki-config.yml`:

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: "2024-01-01"
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h

analytics:
  reporting_enabled: false
```

**Step 2: Create Grafana Loki datasource**

Create `docs/grafana/provisioning/datasources/loki.yml`:

```yaml
apiVersion: 1
datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    isDefault: false
    editable: false
```

**Step 3: Add Loki service to docker-compose.yml**

Add in the monitoring profile section (after the grafana service):

```yaml
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - ./docs/loki/loki-config.yml:/etc/loki/local-config.yaml:ro
      - loki-data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    networks:
      - motherson-net
    restart: unless-stopped
    profiles:
      - monitoring
```

Add `loki-data:` to the `volumes:` section at the bottom of docker-compose.yml.

Update the `grafana` service to add the Loki datasource volume:
```yaml
      - ./docs/grafana/provisioning/datasources/loki.yml:/etc/grafana/provisioning/datasources/loki.yml:ro
```

Also add `depends_on: loki` to the grafana service (alongside existing prometheus dependency).

**Step 4: Validate**

```bash
docker compose config --quiet && echo "VALID"
```

**Step 5: Commit**

```bash
git add docs/loki/ docs/grafana/provisioning/datasources/loki.yml docker-compose.yml
git commit -m "feat: add Loki log aggregation stack (monitoring profile)"
```

---

### Task 7: Secrets Management with SOPS/age

**Files:**
- Create: `scripts/secrets/encrypt.sh`
- Create: `scripts/secrets/decrypt.sh`
- Create: `.sops.yaml`
- Modify: `.gitignore` (add .env, ensure .env.encrypted is tracked)

**Step 1: Create SOPS config**

Create `.sops.yaml`:

```yaml
creation_rules:
  - path_regex: \.env\.encrypted$
    age: >-
      age1REPLACE_WITH_YOUR_PUBLIC_KEY
```

**Step 2: Create encrypt script**

Create `scripts/secrets/encrypt.sh`:

```bash
#!/bin/bash
# Encrypt .env with SOPS/age for safe git storage
# Prerequisites: brew install sops age (or equivalent)
# First time: age-keygen -o ~/.config/sops/age/keys.txt
# Then put the public key in .sops.yaml

set -e

if [ ! -f .env ]; then
    echo "ERROR: .env not found"
    exit 1
fi

if ! command -v sops &> /dev/null; then
    echo "ERROR: sops not installed. Install: brew install sops age"
    exit 1
fi

sops encrypt .env > .env.encrypted
echo "Encrypted .env -> .env.encrypted"
echo "You can safely commit .env.encrypted to git"
```

**Step 3: Create decrypt script**

Create `scripts/secrets/decrypt.sh`:

```bash
#!/bin/bash
# Decrypt .env.encrypted back to .env
# Requires the age private key in ~/.config/sops/age/keys.txt

set -e

if [ ! -f .env.encrypted ]; then
    echo "ERROR: .env.encrypted not found"
    exit 1
fi

if ! command -v sops &> /dev/null; then
    echo "ERROR: sops not installed. Install: brew install sops age"
    exit 1
fi

sops decrypt .env.encrypted > .env
echo "Decrypted .env.encrypted -> .env"
```

**Step 4: Update .gitignore**

Ensure `.env` is in `.gitignore` (should already be there). Add:
```
# Encrypted secrets (safe to commit)
!.env.encrypted
```

**Step 5: Commit**

```bash
chmod +x scripts/secrets/encrypt.sh scripts/secrets/decrypt.sh
git add .sops.yaml scripts/secrets/ .gitignore
git commit -m "chore: add SOPS/age secrets encryption for production deployment"
```

---

## Execution Order

Tasks 1-6 are independent and can be parallelized (no file conflicts).
Task 7 (secrets) is independent but logically runs last.

```
Task 1 (Subflows)        ─┐
Task 2 (SLAs)            ─┤
Task 3 (Terraform)       ─┤
Task 4 (KV Store)        ─┼──→ Task 7 (Secrets)
Task 5 (ZeroClaw pin)    ─┤
Task 6 (Loki)            ─┘
```

## References

- [Kestra Subflows](https://kestra.io/docs/workflow-components/subflows)
- [Kestra SLAs](https://kestra.io/docs/workflow-components/sla)
- [Kestra Terraform Provider](https://kestra.io/docs/terraform/resources/flow)
- [Kestra KV Store](https://kestra.io/docs/concepts/kv-store)
- [Grafana Loki Docker](https://grafana.com/docs/loki/latest/setup/install/docker/)
- [SOPS](https://github.com/getsops/sops)
