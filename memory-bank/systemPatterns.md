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
