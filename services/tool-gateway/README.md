# AutomIT Tool Gateway

Passerelle HTTP Python/FastAPI exposant les outils GLPI, ERP (CEGID/X3 via MCP) et M365 (Graph API) a ZeroClaw et aux flows Kestra. Toutes les requetes (sauf `/health`) sont authentifiees par signature HMAC-SHA256.

## Stack technique

FastAPI 0.115, uvicorn 0.34, httpx 0.28, pyodbc 5.2, pydantic 2.10, pyyaml 6.0

## Demarrage

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 3002
```

## Endpoints

### Health

| Methode | Route     | Description         |
|---------|-----------|---------------------|
| GET     | `/health` | Healthcheck (no auth) |

### GLPI (`/glpi`)

| Methode | Route                          | Description                          |
|---------|--------------------------------|--------------------------------------|
| GET     | `/glpi/ticket/{ticket_id}`     | Contexte ticket + followups          |
| POST    | `/glpi/ticket/{ticket_id}/followup` | Ajouter un followup (private par defaut) |

### ERP (`/erp`)

| Methode | Route                        | Description                            |
|---------|------------------------------|----------------------------------------|
| GET     | `/erp/jobs`                  | Liste des jobs allowlistes (registry)  |
| GET     | `/erp/job/{job_id}/status`   | Statut d'un job via CEGID MCP          |
| POST    | `/erp/job/{job_id}/restart`  | Restart job (bloque Tier 2 — Phase 5)  |

### M365 (`/m365`)

| Methode | Route                  | Description                                 |
|---------|------------------------|---------------------------------------------|
| GET     | `/m365/users`          | Liste utilisateurs Entra ID (pagine)        |
| GET     | `/m365/user/{user_id}` | Detail utilisateur                          |
| GET     | `/m365/risky-signins`  | Utilisateurs a risque (Identity Protection) |

## Middleware

- **HMAC auth** (`middleware/auth.py`) — Verifie `X-Signature: HMAC-SHA256(body, secret)` sur toutes les routes sauf `/health`.
- **Circuit breaker** (`middleware/circuit_breaker.py`) — Par adapter : 5 echecs consecutifs ouvrent le circuit pendant 60 s, puis half-open (1 essai).

## Registry

- **`registry/job_registry.yml`** — Allowlist des jobs CEGID autorises (IMPORT_COMMANDES, SYNC_STOCK, EXPORT_FACTURES, SYNC_ARTICLES, IMPORT_OF). Chaque entree definit `tier`, `cooldown_min` et `erp_system`.
- **`registry/cooldown.py`** — Rate limiting par couple `action + target` : intervalle minimum entre executions et max par heure.

## Variables d'environnement

| Variable               | Usage                                  |
|------------------------|----------------------------------------|
| `GLPI_URL`             | URL de l'instance GLPI                 |
| `GLPI_APP_TOKEN`       | App-Token API GLPI                     |
| `GLPI_USER_TOKEN`      | User token API GLPI                    |
| `CEGID_MCP_URL`        | URL du serveur MCP CEGID               |
| `CEGID_MCP_TOKEN`      | Token `X-MCP-TOKEN` pour CEGID MCP     |
| `AZURE_TENANT_ID`      | Tenant Entra ID                        |
| `AZURE_CLIENT_ID`      | Client ID App Registration             |
| `AZURE_CLIENT_SECRET`  | Client secret App Registration         |
| `AUTOMIT_HMAC_SECRET`  | Secret partage pour signature HMAC     |

## Port

**3002** (par defaut uvicorn)
