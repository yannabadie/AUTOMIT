# Active Context

## Current Status
**First real deployment DONE** — Full stack running on dev machine (10.28.50.7). ERP health-check cycle validated with real data.

## What was just completed
1. ERP connections migrated to MCP servers (cegid-oracle + x3-oracle) — no direct SQL
2. Onboarding/offboarding flows (AD + M365 + ERP provisioning, L2 4-eyes)
3. Microsoft Graph API integration (service health, licenses, MFA, risky users)
4. Grafana monitoring dashboard (Prometheus + Pushgateway, 18 panels)
5. Email notifications via Graph API Mail.Send (4 flows)
6. **First real deployment** — full stack on dev machine, real data flowing:
   - CEGID MCP: OK (59ms response)
   - Sage X3 MCP: responding
   - Graph API: OK (token, licenses, security audit)
   - Prometheus + Pushgateway: metrics flowing
   - Grafana: dashboard with real data
   - ZeroClaw: gateway responding

## Known issues (from deployment)
- **Teams notifications BLOCKED**: Corporate MITM proxy — Kestra JVM doesn't trust corp CA (PKIX error). Fix: inject ca-bundle.pem into JVM trust store.
- **Kestra flow auto-load broken**: `kestra.flows.path` doesn't auto-import. Must POST via API after each restart.
- **Kestra KV Store plugin**: Not installed in kestra:latest. Tasks commented out.
- **Selftest aggregate_and_notify**: JSON parsing error on ZeroClaw output. Minor.
- **Kestra v22.04 breaking changes**: containerImage->image, allowedValues->SELECT, defaults require required:true

## What's next
- **Fix Teams**: Inject corporate CA into Kestra JVM trust store (JAVA_OPTS cacerts)
- **AD service account**: Delegation on OUs, DC FQDN needed
- **Production deployment**: Target VM 002_srvcgdtest.adgroupe.com
- **ZeroClaw pilot**: L3 mode (observation + recommendation only)
- **ad-maintenance.yml**: Replace stubs with real PowerShell cmdlets

## Deployment details
- **Machine**: 10.28.50.7 (Yann dev PC)
- **Services**: Kestra (8080), PostgreSQL, OpenAI proxy, ZeroClaw (42617), Prometheus (9090), Pushgateway (9091), Grafana (3000), Loki (3100)
- **Secrets**: kestra-secrets.env (base64 SECRET_ prefix), loaded via env_file
- **Flows**: 11 flows imported via POST API (not auto-loaded)
