# Premier Deploiement Reel — Full Stack

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the full AutomIT stack run for real on the dev machine (10.28.50.7) and prove a complete cycle: health-check -> metrics -> ZeroClaw -> action.

**Architecture:** Incremental deployment in 4 waves. Wave 1 fills credentials and starts base stack. Wave 2 validates ERP health-check with real MCP servers. Wave 3 activates Graph API + email. Wave 4 enables monitoring (Prometheus + Grafana + Loki) and runs the full selftest.

**Tech Stack:** Docker Compose, Kestra, ZeroClaw, MCP (cegid-oracle, x3-oracle), Microsoft Graph API, Prometheus, Grafana, Loki

---

### Task 1: Fill credentials and missing webhook keys in .env

**Files:**
- Modify: `.env`

**Step 1: Fill Entra ID credentials**

In `.env`, replace the empty AZURE_* lines (83-85) with the real values from INFOS-RSSI.txt:

```bash
# Copier les valeurs depuis INFOS-RSSI.txt (ne PAS committer les secrets)
AZURE_TENANT_ID=<ID de l'annuaire (locataire) depuis INFOS-RSSI.txt>
AZURE_CLIENT_ID=<ID d'application (client) depuis INFOS-RSSI.txt>
AZURE_CLIENT_SECRET=<SECRET depuis INFOS-RSSI.txt>
```

**Step 2: Generate missing webhook keys**

Run:
```bash
cd /c/Code/AutomIT
echo "WEBHOOK_KEY_SELFTEST=$(openssl rand -hex 20)" >> .env
echo "WEBHOOK_KEY_VMWARE_HEALTH=$(openssl rand -hex 20)" >> .env
```

**Step 3: Verify all flow secrets are covered**

Run:
```bash
for secret in $(grep -hro "secret('[^']*')" kestra/flows/*.yml | sort -u | sed "s/secret('//;s/')//"); do
  grep -q "^${secret}=" .env && echo "OK $secret" || echo "MISS $secret"
done
```

Expected: All OK except VSPHERE_* and SERVICENOW_API_URL (not needed for this deployment).

**Step 4: Do NOT commit .env** (contains real secrets)

---

### Task 2: Wave 1 — Start base stack (Kestra + PostgreSQL + ZeroClaw)

**Step 1: Build the custom Python image**

```bash
cd /c/Code/AutomIT
docker build -t automit/python-erp:3.12 -f scripts/docker/Dockerfile.python-erp .
```

Expected: Image built successfully. If ca-bundle.pem is missing, copy it:
```bash
# If needed: copy from X3-Oracle project
cp "C:\Code\X3-Oracle\docker\ca-bundle.pem" zeroclaw/ca-bundle.pem
```

**Step 2: Start the base stack**

```bash
docker compose up -d
```

Expected: 4 services start: postgres, kestra, openai-proxy, zeroclaw-erp-agent.

**Step 3: Wait for Kestra to be ready**

```bash
# Wait ~30s for PostgreSQL to initialize, then Kestra to start
sleep 30
curl -s http://localhost:8080/api/v1/health
```

Expected: `{"status":"UP"}` or similar healthy response.

**Step 4: Verify flows are loaded**

```bash
curl -s -u "yann.abadie@motherson-mas.com:Ch@ngeMeN0w!" \
  http://localhost:8080/api/v1/flows | python -c "import json,sys; flows=json.load(sys.stdin); print(f'{len(flows)} flows loaded'); [print(f'  {f[\"namespace\"]}/{f[\"id\"]}') for f in flows]"
```

Expected: 10 flows listed (erp-health-check, erp-job-restart, ad-maintenance, ad-onboarding, ad-offboarding, m365-audit, incident-escalation-l2, automit-selftest, vmware-health-check, + the 2 subflows in _common).

**Step 5: Check service health**

```bash
docker compose ps
```

Expected: All 4 services "running" (or "healthy" for postgres). If zeroclaw-erp-agent is restarting, check logs:
```bash
docker compose logs zeroclaw-erp-agent --tail 50
```

Common issues:
- `ZEROCLAW_HOST_HOME` directory doesn't exist → create `C:\Users\yann.abadie\.zeroclaw\`
- ca-bundle.pem missing → copy from X3-Oracle
- ZeroClaw auth not configured → will fail to connect to LLM but gateway should still start

**Step 6: Note any issues and fix before proceeding**

---

### Task 3: Wave 2 — Validate ERP health-check with real MCP servers

**Step 1: Trigger erp-health-check manually via webhook**

```bash
curl -X POST "http://localhost:8080/api/v1/executions/webhook/motherson.it.erp/erp-health-check/$(grep WEBHOOK_KEY_HEALTH_CHECK .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: HTTP 200 with execution ID.

**Step 2: Check execution in Kestra UI**

Open http://localhost:8080 in browser. Login: `yann.abadie@motherson-mas.com` / `Ch@ngeMeN0w!`

Navigate to Executions. Find the erp-health-check execution.

Expected: Execution SUCCESS. Tasks check_cegid and check_x3 show real data from MCP servers.

**Step 3: Check task outputs**

In Kestra UI, click on the execution, then on each task to see outputs:
- `check_cegid`: Should show real CEGID session count, job status, data freshness
- `check_x3`: Should show real Sage X3 MCP response
- `check_m365`: Should now show real Graph API data (service health, licenses) since credentials are filled
- `aggregate_and_forward`: Should succeed (Pushgateway not running yet, but the task handles that gracefully)

**Step 4: If any task fails, read the logs and fix**

Common issues:
- MCP server unreachable → check network (ping 10.255.15.200, ping MAS_D0Z9TB4)
- MCP token rejected → verify MCP_CEGID_ORACLE_TOKEN in .env
- Graph API 401 → check AZURE_* credentials, verify permissions were granted with admin consent
- Docker image not found → rebuild with `docker build -t automit/python-erp:3.12 -f scripts/docker/Dockerfile.python-erp .`
- `from lib.mcp_client import` fails → verify Dockerfile has the `COPY scripts/lib /opt/automit/lib` line

**Step 5: Run connectivity tests from host**

```bash
cd /c/Code/AutomIT
python scripts/erp/test_connectivity.py
```

Expected: CEGID MCP tests PASS, Sage X3 MCP tests PASS, M365 tests PASS (now with real credentials).

---

### Task 4: Wave 3 — Validate Graph API + Email sending

**Step 1: Trigger m365-audit manually**

```bash
curl -X POST "http://localhost:8080/api/v1/executions/webhook/motherson.it.ad/m365-audit/$(grep KESTRA_WEBHOOK_KEY .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"mode":"audit_only"}'
```

**Step 2: Check execution in Kestra UI**

Expected:
- `get_graph_token` (subflow): authenticated=True
- `audit_licenses`: Real SKU data (E3, E1, F3 counts)
- `audit_inactive_users`: Real user activity data
- `audit_security`: MFA status, risky users count
- `generate_report`: Overall status with real recommendations
- `notify_result`: Teams notification sent (if webhook URL is real)
- `email_audit_report`: Email sent if mailbox + Application Access Policy are configured

**Step 3: If email fails with 403, the Application Access Policy is not yet applied**

This is expected if the RSSI hasn't run the `New-ApplicationAccessPolicy` PowerShell command yet. The flow still succeeds — email just gets skipped with a warning.

**Step 4: Test onboarding flow (dry validation only)**

```bash
curl -X POST "http://localhost:8080/api/v1/executions/webhook/motherson.it.ad/ad-onboarding/$(grep WEBHOOK_KEY_AD_ONBOARDING .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test",
    "last_name": "AutomIT",
    "job_title": "Test Account",
    "department": "it",
    "site": "serre-castet",
    "manager_email": "yann.abadie@adigroupe.onmicrosoft.com",
    "start_date": "2026-03-01",
    "contract_type": "cdi",
    "erp_access": "none",
    "m365_license": "none"
  }'
```

Expected: Execution starts, `prepare_provisioning_plan` succeeds, then **PAUSES at wait_human_approval** (L2). This proves the flow works up to the human gate. Cancel the execution in Kestra UI after validating.

---

### Task 5: Wave 4 — Enable monitoring and run full selftest

**Step 1: Start monitoring profile**

```bash
docker compose --profile monitoring up -d
```

Expected: 4 new services start: prometheus, pushgateway, grafana, loki.

**Step 2: Verify monitoring services**

```bash
# Prometheus
curl -s http://localhost:9090/-/ready
# Pushgateway
curl -s http://localhost:9091/-/ready
# Grafana
curl -s http://localhost:3000/api/health
# Loki
curl -s http://localhost:3100/ready
```

Expected: All return 200/OK.

**Step 3: Trigger erp-health-check again (now with Pushgateway running)**

```bash
curl -X POST "http://localhost:8080/api/v1/executions/webhook/motherson.it.erp/erp-health-check/$(grep WEBHOOK_KEY_HEALTH_CHECK .env | cut -d= -f2)" \
  -H "Content-Type: application/json" -d '{}'
```

Expected: This time, `aggregate_and_forward` should also push metrics to Pushgateway successfully.

**Step 4: Check Grafana dashboard**

Open http://localhost:3000 (admin / admin).

The AutomIT Overview dashboard should show real data:
- CEGID/X3 health status (HEALTHY/DEGRADED/CRITICAL)
- MCP response times
- M365 license usage
- Security alerts count

**Step 5: Check Prometheus metrics**

```bash
curl -s http://localhost:9090/api/v1/query?query=automit_erp_health | python -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d.get('data',{}).get('result',[]), indent=2))"
```

Expected: Metrics with real values (not empty).

**Step 6: Run the full selftest**

```bash
curl -X POST "http://localhost:8080/api/v1/executions/webhook/motherson.it.ops/automit-selftest/$(grep WEBHOOK_KEY_SELFTEST .env | cut -d= -f2)" \
  -H "Content-Type: application/json" -d '{}'
```

Expected: Execution SUCCESS. Check outputs:
- CEGID MCP: OK
- Sage X3 MCP: OK
- Graph API: OK
- Pushgateway: OK
- ZeroClaw: OK or DEGRADED (if auth not configured)

**Step 7: Celebrate or debug**

If selftest shows all OK: the full stack is running. Update memory-bank/activeContext.md and CLAUDE.md.

If some checks fail: read the Kestra execution logs, fix the issue, re-run selftest.

---

### Task 6: Post-deployment — Update documentation

**Files:**
- Modify: `memory-bank/activeContext.md`
- Modify: `memory-bank/progress.md`
- Modify: `CLAUDE.md` (status line)

**Step 1: Update activeContext.md**

Replace the "Current blockers" section:
```markdown
## Current blockers
- None — stack running on dev machine (10.28.50.7)
```

Add to "What was just completed":
```markdown
6. First real deployment — full stack running on dev machine
```

**Step 2: Update progress.md**

Add to Completed:
```markdown
- [x] First real deployment on dev machine (health-check, Graph API, monitoring)
```

Move from Pending to Completed:
```markdown
- [x] Entra ID App Registration (RSSI approved)
```

**Step 3: Update CLAUDE.md status**

Change status line to reflect real deployment.

**Step 4: Commit**

```bash
git add memory-bank/ CLAUDE.md
git commit -m "docs: update status after first real deployment"
```

---

## Execution Order

Tasks are strictly sequential (each wave depends on the previous):

```
Task 1 (credentials) → Task 2 (base stack) → Task 3 (health-check) → Task 4 (Graph API) → Task 5 (monitoring) → Task 6 (docs)
```

## Troubleshooting Quick Reference

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `docker compose up` fails | ca-bundle.pem missing | `cp C:\Code\X3-Oracle\docker\ca-bundle.pem zeroclaw/` |
| Kestra 502/unreachable | PostgreSQL not ready | Wait 30s, check `docker compose logs postgres` |
| Flows not loaded | Volume mount issue | `docker compose restart kestra` |
| MCP connection refused | Network/firewall | `ping 10.255.15.200` from host |
| Graph API 401 | Wrong credentials or no admin consent | Verify AZURE_* in .env, check Entra ID portal for consent status |
| Graph API 403 on sendMail | Application Access Policy missing | RSSI must run `New-ApplicationAccessPolicy` PowerShell |
| ZeroClaw restarting | Auth not configured / memory limit | Check `docker compose logs zeroclaw-erp-agent`, increase mem_limit if needed |
| Pushgateway metrics empty | health-check not run yet | Trigger erp-health-check via webhook |
| `from lib.mcp_client import` error | Image not rebuilt | `docker build -t automit/python-erp:3.12 -f scripts/docker/Dockerfile.python-erp .` |
