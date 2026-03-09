# Kestra Flows — AutomIT

Workflows Kestra — orchestration deterministe pour l'automatisation IT de Motherson Aerospace.

Les flows sont charges automatiquement via volume mount Docker (`/app/flows`). Chaque script s'execute dans un conteneur Docker isole (`automit/python-erp:3.12` ou `mcr.microsoft.com/powershell:latest`).

## Inventaire des flows

| Flow ID | Namespace | Trigger | Description |
|---------|-----------|---------|-------------|
| `erp-health-check` | `motherson.it.erp` | Cron `*/5 * * * *` + webhook | Surveillance ERP toutes les 5 min (CEGID, Sage X3, M365). Pousse metriques vers Pushgateway, envoie rapport a ZeroClaw. |
| `erp-job-restart` | `motherson.it.erp` | Webhook (ZeroClaw) | L1 — relance automatique des jobs ERP echoues. Inputs SELECT pour `erp_system` et `job_name` (allowlist). Retry 3x / 30s. |
| `ad-maintenance` | `motherson.it.ad` | Cron `0 6 * * 1` + webhook | Audit AD hebdomadaire (comptes inactifs, groupes orphelins, GPO obsoletes). Mode `audit_and_remediate` = L2 avec Pause. |
| `ad-onboarding` | `motherson.it.ad` | Webhook | L2 — provisioning AD + M365 + ERP. Validation humaine obligatoire (4-eyes, EN9100). Email recapitulatif via Graph API. |
| `ad-offboarding` | `motherson.it.ad` | Webhook | L2 — deprovisioning complet (disable AD, revoke M365/sessions, revoke ERP, archive mail). 4-eyes sauf `immediate_disable`. |
| `m365-audit` | `motherson.it.ad` | Cron `0 7 * * 1` + webhook | Audit M365 hebdomadaire : licences, comptes inactifs, MFA, risky users, sign-ins suspects, OAuth apps. Pagination Graph API. |
| `incident-escalation-l2` | `motherson.it.incidents` | Webhook (ZeroClaw) | L2 — creation ticket (INC-YYYYMMDD-hash), notification astreinte, Pause 4h pour validation humaine, puis actions correctives. |
| `automit-selftest` | `motherson.it.ops` | Cron `0 22 * * 0` + webhook | Test de connectivite end-to-end : MCP CEGID, MCP Sage X3, Graph API, Pushgateway, ZeroClaw. Email recapitulatif. |
| `vmware-health-check` | `motherson.it.infra` | Cron `*/15 * * * *` + webhook | Surveillance VMware vSphere : etat ESXi hosts, capacite datastores (seuil 85%). Pousse metriques vers Pushgateway. |

## Conventions

- **Namespaces** : `motherson.it.{erp,ad,incidents,ops,infra}` — un namespace par domaine.
- **Webhook keys** : generes avec `openssl rand -hex 20`, stockes dans `.env`, un par flow. URL : `/api/v1/executions/webhook/{namespace}/{flow-id}/{key}`.
- **Execution Docker-isolee** : tous les scripts tournent dans des conteneurs Docker sur le reseau `automit_motherson-net`. Aucune execution native.
- **Notifications double canal** : Teams webhook (MessageCard) + email Graph API (`Mail.Send` via shared mailbox `automit-noreply@`). Si credentials Entra ID absentes, fallback Teams uniquement.
- **Secrets** : toujours via `secret()` dans les YAML ou variables d'environnement `.env`. Jamais en clair.
- **SLA** : chaque flow critique definit un `MAX_DURATION` avec `behavior: CANCEL`.
- **recoverMissedSchedules** : `NONE` sur tous les triggers cron (pas de rattrapage au redemarrage).

## Securite des inputs

Les flows utilisent plusieurs couches de validation pour empecher l'injection :

1. **SELECT inputs** : `erp_system`, `job_name`, `department`, `severity`, etc. — valeurs controlees par allowlist Kestra.
2. **Validation regex** : dans `erp-job-restart`, le nom du job est valide contre `^[A-Za-z0-9_\-]{1,128}$` avant execution.
3. **Verification exact-match en base** : avant un `sp_start_job`, le flow verifie que le job existe via `SELECT name FROM msdb.dbo.sysjobs WHERE name = N'{job}'` et utilise le nom retourne par la base (pas l'input utilisateur).
4. **Pas de SQL direct** : tout acces ERP passe par les MCP servers (`cegid-oracle`, `x3-oracle`) qui exposent des outils JSON-RPC. Le port 1433 n'est pas accessible depuis Docker.
