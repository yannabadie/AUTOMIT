# Architect Notes

## Architecture Overview
```
Claude Desktop (MCP) ------> Kestra (orchestration)
                                   |
ZeroClaw (AI agent) --webhook----> Kestra flows
                                   |
                         Infrastructure (AD, M365, CEGID, X3)
```

## Key Constraints
1. ZeroClaw never touches infrastructure directly (always via Kestra webhooks)
2. ERP access exclusively via MCP servers (no direct SQL)
3. All sensitive operations require human approval (L2 Pause)
4. Docker isolation for all task execution
5. Corporate MITM proxy requires CA bundle injection

## Container Architecture
- Kestra manages Docker socket — spawns sibling containers for tasks
- automit/python-erp:3.12 = base image for all Python tasks
- mcr.microsoft.com/powershell:latest = base for AD tasks (Linux, needs RSAT workaround)
- nginx:alpine = TLS termination sidecar for ZeroClaw to OpenAI

## Open Questions
- AD PowerShell in Linux containers: Windows container, PSRemoting, or Python ldap3?
- ServiceNow/GLPI integration: REST API or email-to-ticket?
- Multi-site monitoring: single Kestra instance or federated?
