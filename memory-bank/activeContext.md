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
