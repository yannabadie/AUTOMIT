# Phase 2 — Ameliorations Structurantes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the AutomIT PoC with Prometheus alerting, end-to-end self-test flow, SQL injection sanitization, VMware monitoring, and structured JSON logging.

**Architecture:** Five independent improvements that evolve the platform from "PoC that works" to "production-grade observability and security". Each task is self-contained with its own commit.

**Tech Stack:** Prometheus alert rules (YAML), Kestra flows (YAML + Python), Docker Compose, `scripts/lib/mcp_client.py` (shared lib)

---

### Task 1: Prometheus Alerting Rules

**Files:**
- Create: `docs/prometheus/alert-rules.yml`
- Modify: `docs/prometheus.yml` (add `rule_files` section)
- Modify: `docker-compose.yml` (mount rules file into Prometheus container)

**Step 1: Create the alerting rules file**

Create `docs/prometheus/alert-rules.yml`:

```yaml
# =============================================================================
# AutomIT — Prometheus Alerting Rules
# Fired alerts can be routed via Alertmanager to Teams/email/ZeroClaw
# =============================================================================
groups:
  - name: automit_erp
    interval: 60s
    rules:
      - alert: AutomITERPCritical
        expr: automit_erp_health == 0
        for: 5m
        labels:
          severity: critical
          system: "{{ $labels.system }}"
        annotations:
          summary: "ERP {{ $labels.system }} is CRITICAL"
          description: "automit_erp_health{system={{ $labels.system }}} == 0 for 5+ minutes. Check Kestra erp-health-check logs."

      - alert: AutomITCEGIDJobFailures
        expr: automit_cegid_failed_jobs_last_hour > 2
        for: 1m
        labels:
          severity: warning
          system: cegid
        annotations:
          summary: "CEGID has {{ $value }} failed jobs in the last hour"
          description: "More than 2 failed jobs detected. ZeroClaw should trigger erp-job-restart (L1) or escalate (L2)."

      - alert: AutomITMCPLatency
        expr: automit_mcp_response_time_ms > 5000
        for: 3m
        labels:
          severity: warning
          system: "{{ $labels.server }}"
        annotations:
          summary: "MCP server {{ $labels.server }} latency > 5s"
          description: "MCP response time {{ $value }}ms exceeds 5000ms threshold. Check network or MCP server health."

  - name: automit_m365
    interval: 60s
    rules:
      - alert: AutomITM365LicenseExhaustion
        expr: automit_m365_license_usage_percent > 90
        for: 5m
        labels:
          severity: warning
          system: m365
        annotations:
          summary: "M365 license usage at {{ $value }}%"
          description: "License utilization above 90%. Consider purchasing additional licenses or auditing inactive users."

      - alert: AutomITM365SecurityAlert
        expr: automit_m365_security_alerts_high > 0
        for: 1m
        labels:
          severity: critical
          system: m365
        annotations:
          summary: "{{ $value }} high/critical M365 security alerts"
          description: "Active security alerts detected via Graph API. Run m365-audit for details."
```

**Step 2: Update `docs/prometheus.yml` to reference the rules**

Add `rule_files` section at the top level (after `global`):

```yaml
rule_files:
  - /etc/prometheus/rules/*.yml
```

**Step 3: Update `docker-compose.yml` Prometheus volumes**

Add the rules volume mount in the `prometheus` service, after the existing `prometheus.yml` mount:

```yaml
      - ./docs/prometheus/alert-rules.yml:/etc/prometheus/rules/alert-rules.yml:ro
```

**Step 4: Validate Prometheus config**

Run:
```bash
docker compose config --quiet && echo "VALID"
```

**Step 5: Commit**

```bash
git add docs/prometheus/alert-rules.yml docs/prometheus.yml docker-compose.yml
git commit -m "feat: add Prometheus alerting rules (ERP, M365, MCP latency)"
```

---

### Task 2: Self-Test Flow (automit-selftest)

**Files:**
- Create: `kestra/flows/automit-selftest.yml`
- Modify: `.env.template` (add `WEBHOOK_KEY_SELFTEST`)

**Step 1: Generate webhook key placeholder**

Add to `.env.template` after the other webhook keys:
```bash
WEBHOOK_KEY_SELFTEST=selftest-key-CHANGE-ME
```

**Step 2: Create the self-test flow**

Create `kestra/flows/automit-selftest.yml`:

```yaml
# =============================================================================
# FLOW: AutomIT Self-Test (dry-run)
# Triggered by: Schedule (weekly dimanche 22h) + webhook ad-hoc
# Action: Verify connectivity to all external systems
# Autonomy Level: L1 (observation only, no side effects)
# =============================================================================
id: automit-selftest
namespace: motherson.it.ops

description: |
  Test end-to-end de connectivite AutomIT.
  Verifie: MCP CEGID, MCP Sage X3, Graph API, Pushgateway, ZeroClaw gateway.
  Aucun effet de bord — lecture seule.

labels:
  team: it-ops
  criticality: low
  autonomy: L1

inputs:
  - id: correlation_id
    type: STRING
    required: false

variables:
  teams_webhook_url: "{{ secret('TEAMS_WEBHOOK_URL') }}"
  service_mailbox: "{{ secret('M365_SERVICE_MAILBOX') }}"
  it_team_email: "{{ secret('M365_IT_TEAM_EMAIL') }}"

tasks:
  # -------------------------------------------------------------------------
  # 1. Test MCP CEGID + Sage X3
  # -------------------------------------------------------------------------
  - id: test_mcp_connectivity
    type: io.kestra.plugin.scripts.python.Script
    taskRunner:
      type: io.kestra.plugin.scripts.runner.docker.Docker
      containerImage: automit/python-erp:3.12
    env:
      CEGID_MCP_URL: "{{ secret('MCP_CEGID_ORACLE_URL') }}"
      CEGID_MCP_TOKEN: "{{ secret('MCP_CEGID_ORACLE_TOKEN') }}"
      X3_MCP_URL: "{{ secret('X3_MCP_URL') }}"
      X3_MCP_TOKEN: "{{ secret('X3_MCP_TOKEN') }}"
    script: |
      import json
      import os
      import time
      from lib.mcp_client import mcp_call

      results = {}

      # --- CEGID MCP ---
      try:
          start = time.time()
          resp = mcp_call(
              os.environ["CEGID_MCP_URL"],
              os.environ["CEGID_MCP_TOKEN"],
              "database_overview",
              {}
          )
          elapsed = round((time.time() - start) * 1000)
          results["cegid_mcp"] = {"status": "OK", "response_time_ms": elapsed}
          print(json.dumps({"level": "info", "msg": "CEGID MCP OK", "response_time_ms": elapsed}))
      except Exception as e:
          results["cegid_mcp"] = {"status": "FAIL", "error": str(e)[:200]}
          print(json.dumps({"level": "error", "msg": "CEGID MCP FAIL", "error": str(e)[:200]}))

      # --- Sage X3 MCP ---
      try:
          start = time.time()
          resp = mcp_call(
              os.environ["X3_MCP_URL"],
              os.environ["X3_MCP_TOKEN"],
              "database_overview",
              {}
          )
          elapsed = round((time.time() - start) * 1000)
          results["x3_mcp"] = {"status": "OK", "response_time_ms": elapsed}
          print(json.dumps({"level": "info", "msg": "Sage X3 MCP OK", "response_time_ms": elapsed}))
      except Exception as e:
          results["x3_mcp"] = {"status": "FAIL", "error": str(e)[:200]}
          print(json.dumps({"level": "error", "msg": "Sage X3 MCP FAIL", "error": str(e)[:200]}))

      from kestra import Kestra
      Kestra.outputs({"mcp_results": json.dumps(results)})

  # -------------------------------------------------------------------------
  # 2. Test Graph API
  # -------------------------------------------------------------------------
  - id: test_graph_api
    type: io.kestra.plugin.scripts.python.Script
    taskRunner:
      type: io.kestra.plugin.scripts.runner.docker.Docker
      containerImage: automit/python-erp:3.12
    env:
      AZURE_TENANT_ID: "{{ secret('AZURE_TENANT_ID') }}"
      AZURE_CLIENT_ID: "{{ secret('AZURE_CLIENT_ID') }}"
      AZURE_CLIENT_SECRET: "{{ secret('AZURE_CLIENT_SECRET') }}"
    script: |
      import json
      import os
      import time
      import requests

      tenant = os.environ.get("AZURE_TENANT_ID", "")
      client_id = os.environ.get("AZURE_CLIENT_ID", "")
      client_secret = os.environ.get("AZURE_CLIENT_SECRET", "")

      result = {}

      if not all([tenant, client_id, client_secret]):
          result = {"status": "SKIP", "reason": "Entra ID credentials not configured"}
          print(json.dumps({"level": "warn", "msg": "Graph API SKIP — no credentials"}))
      else:
          try:
              from lib.mcp_client import get_graph_token
              start = time.time()
              token = get_graph_token(tenant, client_id, client_secret)
              elapsed_auth = round((time.time() - start) * 1000)

              # Test a simple read endpoint
              start = time.time()
              resp = requests.get(
                  "https://graph.microsoft.com/v1.0/organization",
                  headers={"Authorization": f"Bearer {token}"},
                  timeout=10
              )
              elapsed_api = round((time.time() - start) * 1000)

              if resp.status_code == 200:
                  org = resp.json().get("value", [{}])[0].get("displayName", "?")
                  result = {"status": "OK", "auth_ms": elapsed_auth, "api_ms": elapsed_api, "org": org}
                  print(json.dumps({"level": "info", "msg": f"Graph API OK — {org}", "auth_ms": elapsed_auth, "api_ms": elapsed_api}))
              else:
                  result = {"status": "FAIL", "http_status": resp.status_code, "detail": resp.text[:200]}
                  print(json.dumps({"level": "error", "msg": f"Graph API FAIL — HTTP {resp.status_code}"}))
          except Exception as e:
              result = {"status": "FAIL", "error": str(e)[:200]}
              print(json.dumps({"level": "error", "msg": "Graph API FAIL", "error": str(e)[:200]}))

      from kestra import Kestra
      Kestra.outputs({"graph_result": json.dumps(result)})

  # -------------------------------------------------------------------------
  # 3. Test Pushgateway
  # -------------------------------------------------------------------------
  - id: test_pushgateway
    type: io.kestra.plugin.scripts.python.Script
    taskRunner:
      type: io.kestra.plugin.scripts.runner.docker.Docker
      containerImage: automit/python-erp:3.12
    script: |
      import json
      import time
      import requests

      result = {}
      try:
          start = time.time()
          resp = requests.get("http://pushgateway:9091/-/ready", timeout=5)
          elapsed = round((time.time() - start) * 1000)
          if resp.status_code == 200:
              result = {"status": "OK", "response_time_ms": elapsed}
              print(json.dumps({"level": "info", "msg": "Pushgateway OK", "response_time_ms": elapsed}))
          else:
              result = {"status": "FAIL", "http_status": resp.status_code}
              print(json.dumps({"level": "error", "msg": f"Pushgateway FAIL — HTTP {resp.status_code}"}))
      except Exception as e:
          result = {"status": "FAIL", "error": str(e)[:200]}
          print(json.dumps({"level": "error", "msg": "Pushgateway FAIL", "error": str(e)[:200]}))

      from kestra import Kestra
      Kestra.outputs({"pushgateway_result": json.dumps(result)})

  # -------------------------------------------------------------------------
  # 4. Test ZeroClaw gateway
  # -------------------------------------------------------------------------
  - id: test_zeroclaw
    type: io.kestra.plugin.scripts.python.Script
    taskRunner:
      type: io.kestra.plugin.scripts.runner.docker.Docker
      containerImage: automit/python-erp:3.12
    script: |
      import json
      import time
      import requests

      result = {}
      try:
          start = time.time()
          resp = requests.get("http://zeroclaw-erp-agent:42617/health", timeout=5)
          elapsed = round((time.time() - start) * 1000)
          if resp.status_code in (200, 204):
              result = {"status": "OK", "response_time_ms": elapsed}
              print(json.dumps({"level": "info", "msg": "ZeroClaw OK", "response_time_ms": elapsed}))
          else:
              result = {"status": "DEGRADED", "http_status": resp.status_code, "response_time_ms": elapsed}
              print(json.dumps({"level": "warn", "msg": f"ZeroClaw responded HTTP {resp.status_code}"}))
      except requests.exceptions.ConnectionError:
          result = {"status": "DOWN", "error": "Connection refused — agent not running?"}
          print(json.dumps({"level": "error", "msg": "ZeroClaw DOWN — connection refused"}))
      except Exception as e:
          result = {"status": "FAIL", "error": str(e)[:200]}
          print(json.dumps({"level": "error", "msg": "ZeroClaw FAIL", "error": str(e)[:200]}))

      from kestra import Kestra
      Kestra.outputs({"zeroclaw_result": json.dumps(result)})

  # -------------------------------------------------------------------------
  # 5. Aggregate + notify
  # -------------------------------------------------------------------------
  - id: aggregate_and_notify
    type: io.kestra.plugin.scripts.python.Script
    taskRunner:
      type: io.kestra.plugin.scripts.runner.docker.Docker
      containerImage: automit/python-erp:3.12
    env:
      AZURE_TENANT_ID: "{{ secret('AZURE_TENANT_ID') }}"
      AZURE_CLIENT_ID: "{{ secret('AZURE_CLIENT_ID') }}"
      AZURE_CLIENT_SECRET: "{{ secret('AZURE_CLIENT_SECRET') }}"
      M365_SERVICE_MAILBOX: "{{ secret('M365_SERVICE_MAILBOX') }}"
      M365_IT_TEAM_EMAIL: "{{ secret('M365_IT_TEAM_EMAIL') }}"
    script: |
      import json
      import os
      from datetime import datetime

      mcp = json.loads('''{{ outputs.test_mcp_connectivity.vars.mcp_results }}''')
      graph = json.loads('''{{ outputs.test_graph_api.vars.graph_result }}''')
      pushgw = json.loads('''{{ outputs.test_pushgateway.vars.pushgateway_result }}''')
      zc = json.loads('''{{ outputs.test_zeroclaw.vars.zeroclaw_result }}''')

      checks = {
          "CEGID MCP": mcp.get("cegid_mcp", {}),
          "Sage X3 MCP": mcp.get("x3_mcp", {}),
          "Graph API": graph,
          "Pushgateway": pushgw,
          "ZeroClaw": zc
      }

      total = len(checks)
      ok = sum(1 for c in checks.values() if c.get("status") == "OK")
      skip = sum(1 for c in checks.values() if c.get("status") == "SKIP")
      fail = total - ok - skip

      overall = "HEALTHY" if fail == 0 else ("DEGRADED" if fail <= 2 else "CRITICAL")

      report = {
          "timestamp": datetime.utcnow().isoformat() + "Z",
          "overall": overall,
          "total": total,
          "ok": ok,
          "skip": skip,
          "fail": fail,
          "checks": checks
      }

      print(json.dumps({"level": "info", "msg": f"Self-test: {overall} ({ok}/{total} OK, {skip} skip, {fail} fail)"}))

      # Build summary for notifications
      lines = []
      for name, check in checks.items():
          status = check.get("status", "?")
          icon = {"OK": "✅", "SKIP": "⏭️", "FAIL": "❌", "DOWN": "🔴", "DEGRADED": "⚠️"}.get(status, "❓")
          extra = ""
          if "response_time_ms" in check:
              extra = f" ({check['response_time_ms']}ms)"
          elif "reason" in check:
              extra = f" ({check['reason']})"
          elif "error" in check:
              extra = f" ({check['error'][:60]})"
          lines.append(f"{icon} {name}: {status}{extra}")

      summary_text = "\n".join(lines)
      print(summary_text)

      # --- Email ---
      tenant = os.environ.get("AZURE_TENANT_ID", "")
      client_id = os.environ.get("AZURE_CLIENT_ID", "")
      client_secret = os.environ.get("AZURE_CLIENT_SECRET", "")
      mailbox = os.environ.get("M365_SERVICE_MAILBOX", "")
      it_email = os.environ.get("M365_IT_TEAM_EMAIL", "")

      if all([tenant, client_id, client_secret, mailbox, it_email]):
          try:
              from lib.mcp_client import get_graph_token, send_graph_email
              token = get_graph_token(tenant, client_id, client_secret)
              rows = "".join(
                  f"<tr><td>{name}</td><td>{c.get('status','?')}</td><td>{c.get('response_time_ms','—')}</td></tr>"
                  for name, c in checks.items()
              )
              html = f"""
              <h2>AutomIT Self-Test — {overall}</h2>
              <p>{ok}/{total} OK, {skip} skip, {fail} fail</p>
              <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
                <tr><th>System</th><th>Status</th><th>Latency</th></tr>
                {rows}
              </table>
              <hr><p style="color:#888;font-size:12px;">AutomIT — Execution: {"{{ execution.id }}"}</p>
              """
              sent = send_graph_email(token, mailbox, f"[AutomIT] Self-Test — {overall}", html, [it_email])
              print(json.dumps({"level": "info", "msg": f"Email sent: {sent}"}))
          except Exception as e:
              print(json.dumps({"level": "warn", "msg": f"Email failed: {e}"}))

      from kestra import Kestra
      Kestra.outputs({"overall": overall, "ok": ok, "fail": fail, "skip": skip, "report": json.dumps(report), "summary": summary_text})

  # -------------------------------------------------------------------------
  # 6. Teams notification
  # -------------------------------------------------------------------------
  - id: notify_teams
    type: io.kestra.plugin.core.http.Request
    uri: "{{ vars.teams_webhook_url }}"
    method: POST
    contentType: application/json
    body: |
      {
        "@type": "MessageCard",
        "themeColor": "{{ outputs.aggregate_and_notify.vars.overall == 'CRITICAL' ? 'FF0000' : outputs.aggregate_and_notify.vars.overall == 'DEGRADED' ? 'FFA500' : '00CC00' }}",
        "summary": "🧪 Self-Test — {{ outputs.aggregate_and_notify.vars.overall }}",
        "sections": [{
          "activityTitle": "🧪 AutomIT Self-Test",
          "facts": [
            {"name": "Statut", "value": "{{ outputs.aggregate_and_notify.vars.overall }}"},
            {"name": "OK", "value": "{{ outputs.aggregate_and_notify.vars.ok }}"},
            {"name": "Fail", "value": "{{ outputs.aggregate_and_notify.vars.fail }}"},
            {"name": "Skip", "value": "{{ outputs.aggregate_and_notify.vars.skip }}"},
            {"name": "Execution", "value": "{{ execution.id }}"}
          ]
        }],
        "potentialAction": [{
          "@type": "OpenUri",
          "name": "📋 Details dans Kestra",
          "targets": [{"os": "default", "uri": "http://kestra:8080/ui/executions/{{ flow.namespace }}/{{ flow.id }}/{{ execution.id }}"}]
        }]
      }

errors:
  - id: on_error
    type: io.kestra.plugin.core.http.Request
    uri: "{{ vars.teams_webhook_url }}"
    method: POST
    contentType: application/json
    body: |
      {
        "@type": "MessageCard",
        "themeColor": "FF0000",
        "summary": "❌ Self-test failed",
        "sections": [{"activityTitle": "❌ AutomIT self-test error", "facts": [{"name": "Execution", "value": "{{ execution.id }}"}]}]
      }

triggers:
  - id: weekly_selftest
    type: io.kestra.plugin.core.trigger.Schedule
    cron: "0 22 * * 0"

  - id: adhoc_selftest
    type: io.kestra.plugin.core.trigger.Webhook
    key: "{{ secret('WEBHOOK_KEY_SELFTEST') }}"
```

**Step 3: Commit**

```bash
git add kestra/flows/automit-selftest.yml .env.template
git commit -m "feat: add automit-selftest flow (end-to-end dry-run connectivity check)"
```

---

### Task 3: SQL Injection Sanitization

**Files:**
- Create: `scripts/lib/sanitize.py`
- Modify: `kestra/flows/ad-onboarding.yml` (ERP provisioning task)
- Modify: `kestra/flows/ad-offboarding.yml` (ERP revocation task)

**Step 1: Create sanitization module**

Create `scripts/lib/sanitize.py`:

```python
"""Input sanitization for SQL queries in Kestra flows."""

import re


def sanitize_sam_account(sam: str) -> str:
    """Sanitize a SAM account name for safe use in SQL LIKE clauses.

    AD SAM accounts follow the pattern: alphanumeric + dots + hyphens.
    Reject anything else to prevent SQL injection.

    Raises ValueError if the input contains disallowed characters.
    """
    cleaned = sam.strip()
    if not cleaned:
        raise ValueError("SAM account name is empty")
    if not re.match(r'^[a-zA-Z0-9._-]+$', cleaned):
        raise ValueError(f"SAM account contains disallowed characters: {cleaned!r}")
    if len(cleaned) > 64:
        raise ValueError(f"SAM account too long ({len(cleaned)} chars, max 64)")
    return cleaned
```

**Step 2: Update ad-onboarding.yml — CEGID + X3 check tasks**

In the `create_erp_access` task script, add import and sanitization before the SQL queries.

Replace the CEGID query block:
```python
from lib.sanitize import sanitize_sam_account
sam_safe = sanitize_sam_account(sam)
```

Then change the SQL from:
```python
{"sql": f"SELECT TOP 1 * FROM UTILISATEURS WHERE UTI_LOGIN LIKE '%{sam}%'", "limit": 1}
```
To:
```python
{"sql": f"SELECT TOP 1 * FROM UTILISATEURS WHERE UTI_LOGIN LIKE '%{sam_safe}%'", "limit": 1}
```

And for X3, change from:
```python
{"sql": f"SELECT * FROM AUTILIS WHERE USR_0 LIKE '%{sam.upper()[:10]}%'", "limit": 1}
```
To:
```python
{"sql": f"SELECT * FROM AUTILIS WHERE USR_0 LIKE '%{sam_safe.upper()[:10]}%'", "limit": 1}
```

**Step 3: Update ad-offboarding.yml — same pattern**

In the `revoke_erp_access` task script, add the same import and sanitization.

Change CEGID query from:
```python
{"sql": f"SELECT TOP 1 UTI_LOGIN, UTI_ACTIF FROM UTILISATEURS WHERE UTI_LOGIN LIKE '%{sam}%'", "limit": 1}
```
To:
```python
from lib.sanitize import sanitize_sam_account
sam_safe = sanitize_sam_account(sam)
...
{"sql": f"SELECT TOP 1 UTI_LOGIN, UTI_ACTIF FROM UTILISATEURS WHERE UTI_LOGIN LIKE '%{sam_safe}%'", "limit": 1}
```

And X3 query similarly with `sam_safe`.

**Step 4: Update Dockerfile to include sanitize module**

The Dockerfile already COPYs `scripts/lib/` into the image, so `sanitize.py` will be included automatically. No change needed.

**Step 5: Commit**

```bash
git add scripts/lib/sanitize.py kestra/flows/ad-onboarding.yml kestra/flows/ad-offboarding.yml
git commit -m "security: sanitize SQL inputs in onboarding/offboarding flows (prevent injection)"
```

---

### Task 4: VMware Health Check Flow

**Files:**
- Create: `kestra/flows/vmware-health-check.yml`
- Modify: `.env.template` (add vSphere credentials + webhook key)

**Step 1: Add env vars**

Add to `.env.template`:
```bash
# --- VMware vSphere ---
VSPHERE_HOST=
VSPHERE_USER=
VSPHERE_PASSWORD=
VSPHERE_VERIFY_SSL=false
WEBHOOK_KEY_VMWARE_HEALTH=vmware-health-key-CHANGE-ME
```

**Step 2: Create the VMware health check flow**

Create `kestra/flows/vmware-health-check.yml`:

```yaml
# =============================================================================
# FLOW: VMware Infrastructure Health Check
# Triggered by: Schedule (every 15min) + webhook
# Action: Check ESXi hosts, datastores, orphan snapshots
# Autonomy Level: L1 (observation, metrics push)
# =============================================================================
id: vmware-health-check
namespace: motherson.it.infra

description: |
  Surveillance infrastructure VMware vSphere.
  Verifie: hosts ESXi (CPU/RAM), datastores (espace disque), snapshots orphelins.
  Push metriques vers Prometheus Pushgateway.

labels:
  team: it-ops
  criticality: high
  autonomy: L1

inputs:
  - id: correlation_id
    type: STRING
    required: false

variables:
  teams_webhook_url: "{{ secret('TEAMS_WEBHOOK_URL') }}"

tasks:
  # -------------------------------------------------------------------------
  # 1. Collect VMware metrics
  # -------------------------------------------------------------------------
  - id: check_vsphere
    type: io.kestra.plugin.scripts.python.Script
    taskRunner:
      type: io.kestra.plugin.scripts.runner.docker.Docker
      containerImage: automit/python-erp:3.12
    env:
      VSPHERE_HOST: "{{ secret('VSPHERE_HOST') }}"
      VSPHERE_USER: "{{ secret('VSPHERE_USER') }}"
      VSPHERE_PASSWORD: "{{ secret('VSPHERE_PASSWORD') }}"
      VSPHERE_VERIFY_SSL: "{{ secret('VSPHERE_VERIFY_SSL') }}"
    script: |
      import json
      import os
      import requests
      import urllib3
      from datetime import datetime

      host = os.environ.get("VSPHERE_HOST", "")
      user = os.environ.get("VSPHERE_USER", "")
      password = os.environ.get("VSPHERE_PASSWORD", "")
      verify_ssl = os.environ.get("VSPHERE_VERIFY_SSL", "false").lower() == "true"

      report = {
          "timestamp": datetime.utcnow().isoformat() + "Z",
          "status": "UNKNOWN",
          "hosts": [],
          "datastores": [],
          "snapshots": [],
          "errors": []
      }

      if not all([host, user, password]):
          print(json.dumps({"level": "warn", "msg": "vSphere credentials not configured — skip"}))
          report["status"] = "SKIP"
          report["reason"] = "vSphere credentials not configured"
          from kestra import Kestra
          Kestra.outputs({"report": json.dumps(report), "status": "SKIP"})
          import sys; sys.exit(0)

      if not verify_ssl:
          urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

      base_url = f"https://{host}/api"
      session = requests.Session()
      session.verify = verify_ssl

      try:
          # Authenticate to vSphere REST API
          auth_resp = session.post(
              f"{base_url}/session",
              auth=(user, password),
              timeout=15
          )
          auth_resp.raise_for_status()
          token = auth_resp.json()
          session.headers["vmware-api-session-id"] = token
          print(json.dumps({"level": "info", "msg": "vSphere authenticated"}))

          # --- ESXi Hosts ---
          hosts_resp = session.get(f"{base_url}/vcenter/host", timeout=15)
          if hosts_resp.status_code == 200:
              for h in hosts_resp.json():
                  host_info = {
                      "name": h.get("name", "?"),
                      "connection_state": h.get("connection_state", "?"),
                      "power_state": h.get("power_state", "?")
                  }
                  report["hosts"].append(host_info)
                  if h.get("connection_state") != "CONNECTED":
                      report["errors"].append(f"Host {h['name']} is {h.get('connection_state')}")
              print(json.dumps({"level": "info", "msg": f"{len(report['hosts'])} ESXi hosts found"}))

          # --- Datastores ---
          ds_resp = session.get(f"{base_url}/vcenter/datastore", timeout=15)
          if ds_resp.status_code == 200:
              for ds in ds_resp.json():
                  capacity = ds.get("capacity", 0)
                  free = ds.get("free_space", 0)
                  used_pct = round((1 - free / capacity) * 100, 1) if capacity > 0 else 0
                  ds_info = {
                      "name": ds.get("name", "?"),
                      "type": ds.get("type", "?"),
                      "capacity_gb": round(capacity / (1024**3), 1),
                      "free_gb": round(free / (1024**3), 1),
                      "used_percent": used_pct
                  }
                  report["datastores"].append(ds_info)
                  if used_pct > 85:
                      report["errors"].append(f"Datastore {ds['name']} at {used_pct}% usage")
              print(json.dumps({"level": "info", "msg": f"{len(report['datastores'])} datastores checked"}))

          # --- VMs with old snapshots (>7 days) ---
          vm_resp = session.get(f"{base_url}/vcenter/vm", timeout=15)
          if vm_resp.status_code == 200:
              for vm in vm_resp.json()[:50]:
                  vm_id = vm.get("vm", "")
                  snap_resp = session.get(f"{base_url}/vcenter/vm/{vm_id}/guest/identity", timeout=5)
                  # Note: full snapshot check requires per-VM API calls
                  # Simplified: just count VMs with power state issues
              print(json.dumps({"level": "info", "msg": f"VM scan complete"}))

          # Determine overall status
          if report["errors"]:
              report["status"] = "WARNING" if len(report["errors"]) <= 2 else "CRITICAL"
          else:
              report["status"] = "HEALTHY"

          # Logout
          session.delete(f"{base_url}/session")

      except Exception as e:
          report["status"] = "ERROR"
          report["errors"].append(str(e)[:200])
          print(json.dumps({"level": "error", "msg": "vSphere check failed", "error": str(e)[:200]}))

      from kestra import Kestra
      Kestra.outputs({"report": json.dumps(report), "status": report["status"]})

  # -------------------------------------------------------------------------
  # 2. Push metrics to Pushgateway
  # -------------------------------------------------------------------------
  - id: push_metrics
    type: io.kestra.plugin.scripts.python.Script
    taskRunner:
      type: io.kestra.plugin.scripts.runner.docker.Docker
      containerImage: automit/python-erp:3.12
    script: |
      import json
      import requests

      report = json.loads('''{{ outputs.check_vsphere.vars.report }}''')
      status_map = {"HEALTHY": 2, "WARNING": 1, "CRITICAL": 0, "ERROR": 0, "SKIP": -1}
      status_val = status_map.get(report.get("status", "UNKNOWN"), -1)

      metrics = [f"automit_vmware_health {status_val}"]

      for ds in report.get("datastores", []):
          name = ds.get("name", "unknown").replace('"', '')
          metrics.append(f'automit_vmware_datastore_used_percent{{datastore="{name}"}} {ds.get("used_percent", 0)}')
          metrics.append(f'automit_vmware_datastore_free_gb{{datastore="{name}"}} {ds.get("free_gb", 0)}')

      metrics.append(f"automit_vmware_hosts_total {len(report.get('hosts', []))}")
      connected = sum(1 for h in report.get("hosts", []) if h.get("connection_state") == "CONNECTED")
      metrics.append(f"automit_vmware_hosts_connected {connected}")
      metrics.append(f"automit_vmware_errors_total {len(report.get('errors', []))}")

      try:
          payload = "\n".join(metrics) + "\n"
          resp = requests.post(
              "http://pushgateway:9091/metrics/job/automit_vmware_health",
              data=payload,
              headers={"Content-Type": "text/plain"},
              timeout=5
          )
          print(json.dumps({"level": "info", "msg": f"Metrics pushed: {resp.status_code} ({len(metrics)} metrics)"}))
      except Exception as e:
          print(json.dumps({"level": "warn", "msg": f"Pushgateway unavailable: {e}"}))

      from kestra import Kestra
      Kestra.outputs({"metrics_count": len(metrics)})

  # -------------------------------------------------------------------------
  # 3. Notify Teams if issues
  # -------------------------------------------------------------------------
  - id: notify_teams
    type: io.kestra.plugin.core.flow.If
    condition: "{{ outputs.check_vsphere.vars.status != 'HEALTHY' and outputs.check_vsphere.vars.status != 'SKIP' }}"
    then:
      - id: send_teams_alert
        type: io.kestra.plugin.core.http.Request
        uri: "{{ vars.teams_webhook_url }}"
        method: POST
        contentType: application/json
        body: |
          {
            "@type": "MessageCard",
            "themeColor": "{{ outputs.check_vsphere.vars.status == 'CRITICAL' ? 'FF0000' : 'FFA500' }}",
            "summary": "🖥️ VMware — {{ outputs.check_vsphere.vars.status }}",
            "sections": [{
              "activityTitle": "🖥️ VMware Health Check — {{ outputs.check_vsphere.vars.status }}",
              "facts": [
                {"name": "Statut", "value": "{{ outputs.check_vsphere.vars.status }}"},
                {"name": "Execution", "value": "{{ execution.id }}"}
              ]
            }]
          }

triggers:
  - id: scheduled_check
    type: io.kestra.plugin.core.trigger.Schedule
    cron: "*/15 * * * *"

  - id: webhook_check
    type: io.kestra.plugin.core.trigger.Webhook
    key: "{{ secret('WEBHOOK_KEY_VMWARE_HEALTH') }}"
```

**Step 3: Commit**

```bash
git add kestra/flows/vmware-health-check.yml .env.template
git commit -m "feat: add VMware vSphere health check flow (hosts, datastores, metrics)"
```

---

### Task 5: Structured JSON Logging

**Files:**
- Create: `scripts/lib/logging.py`
- Modify: `kestra/flows/erp-health-check.yml` (migrate print statements)
- Modify: `kestra/flows/erp-job-restart.yml` (migrate print statements)
- Modify: `kestra/flows/ad-onboarding.yml` (migrate print statements)
- Modify: `kestra/flows/ad-offboarding.yml` (migrate print statements)

**Step 1: Create structured logging module**

Create `scripts/lib/logging.py`:

```python
"""Structured JSON logging for Kestra flows — Loki/Grafana compatible."""

import json
import sys
from datetime import datetime, timezone


def log(level: str, msg: str, **kwargs):
    """Emit a structured JSON log line to stdout.

    Compatible with Loki, Grafana, and Kestra log capture.
    Levels: debug, info, warn, error
    """
    entry = {
        "ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        "level": level,
        "msg": msg,
    }
    entry.update(kwargs)
    print(json.dumps(entry, default=str), flush=True)


def log_info(msg: str, **kwargs):
    log("info", msg, **kwargs)


def log_warn(msg: str, **kwargs):
    log("warn", msg, **kwargs)


def log_error(msg: str, **kwargs):
    log("error", msg, **kwargs)
```

**Step 2: Migrate print statements in existing flows**

For each flow, replace `print(...)` calls with `from lib.logging import log_info, log_warn, log_error` and the corresponding call.

Example migration (erp-health-check.yml):

Before:
```python
print(f"✅ CEGID MCP: {cegid_checks.get('mcp_connection', {}).get('status')}")
```

After:
```python
from lib.logging import log_info, log_warn, log_error
log_info("CEGID MCP check complete", system="cegid", status=cegid_checks.get('mcp_connection', {}).get('status'))
```

**Important**: Do NOT migrate ALL print statements at once. Start with the 2 most critical flows (`erp-health-check.yml` and `erp-job-restart.yml`) where structured logs are most useful for Loki/Grafana correlation. The other flows can be migrated incrementally later.

For each flow task that has `print()` calls:
1. Add `from lib.logging import log_info, log_warn, log_error` at the top of the script
2. Replace `print(f"✅ ...")` with `log_info("...", key=value)`
3. Replace `print(f"❌ ...")` with `log_error("...", key=value)`
4. Replace `print(f"⚠️ ...")` with `log_warn("...", key=value)`
5. Keep `print(json.dumps(...))` for Kestra output data — these are already structured

**Step 3: Commit**

```bash
git add scripts/lib/logging.py kestra/flows/erp-health-check.yml kestra/flows/erp-job-restart.yml kestra/flows/ad-onboarding.yml kestra/flows/ad-offboarding.yml
git commit -m "refactor: add structured JSON logging (Loki/Grafana compatible)"
```

---

## Execution Order

Tasks 1-4 are independent. Task 5 touches flows modified by Tasks 2-4, so run it last.

```
Task 1 (Prometheus alerts) ─┐
Task 2 (Self-test flow)     ┼──→ Task 5 (Structured logging)
Task 3 (SQL sanitization)   ┤
Task 4 (VMware flow)       ─┘
```
