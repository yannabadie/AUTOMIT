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
