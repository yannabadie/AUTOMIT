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
