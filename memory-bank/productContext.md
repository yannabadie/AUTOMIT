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
