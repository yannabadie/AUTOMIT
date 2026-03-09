# AutomIT Control Plane

Serveur Express TypeScript qui implemente le control plane d'AutomIT. Il recoit les
requetes GLPI (via plugin ou MCP), assemble le contexte du ticket, interroge Claude
(Agent SDK, `permissionMode: "dontAsk"` + `allowedTools`) et orchestre l'execution
des actions selon un modele d'autonomie a 3 tiers.

## Stack technique

| Composant | Role |
|-----------|------|
| **TypeScript / Express** | Serveur HTTP (port 3001) |
| **Claude Agent SDK** | Raisonnement, analyse, proposition d'actions |
| **Zod** | Validation des schemas d'entree/sortie |
| **yaml** | Chargement des policies (tiers, cooldowns) |

## Architecture

```
GLPI ──HMAC──▶ Control Plane ──▶ Claude Agent SDK
                    │                    │
                    ▼                    ▼
              Policy Engine        Tool Gateway
              (tiers, cooldowns,   (GLPI, AD, ERP)
               emergency stop)
                    │
                    ▼
               Audit Trail
```

### Modules

- **`middleware/auth.ts`** — Authentification HMAC-SHA256 sur chaque requete
  (signature `X-Automit-Signature`, fenetre de fraicheur 5 min). Le endpoint
  `/kill` utilise un token admin (`X-Automit-Admin-Token`).
- **`context-assembler.ts`** — Recupere le ticket GLPI (description, suivis,
  assets lies) via le Tool Gateway et construit le prompt contextuel.
- **`policy-engine.ts`** — Validation des tiers (1/2/3), cooldowns par
  action+cible, rate limiting horaire, emergency stop global.
- **`audit.ts`** — Trace d'audit in-memory : chaque execution produit un
  `AuditReceipt` (receipt_id, target, requestor, tier, result, timestamp).

### Routes

| Methode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/analyze` | Analyse un ticket (mode normal ou draft) |
| `POST` | `/propose_actions` | Propose des actions tiered avec TTL et rollback |
| `POST` | `/execute` | Execute une action validee par le policy engine |
| `GET` | `/status/:action_id` | Consulte le receipt d'une action executee |
| `POST` | `/kill` | Emergency stop (admin token requis) |
| `GET` | `/health` | Health check (sans auth) |

## Commandes

```bash
# Developpement (hot reload via tsx)
npm run dev

# Build TypeScript
npm run build

# Type checking
npm run typecheck
```

## Variables d'environnement

| Variable | Requis | Description |
|----------|--------|-------------|
| `PORT` | Non | Port d'ecoute (defaut: `3001`) |
| `AUTOMIT_HMAC_SECRET` | Oui | Secret HMAC-SHA256 partage avec GLPI |
| `AUTOMIT_ADMIN_TOKEN` | Oui | Token admin pour le endpoint `/kill` |
| `TOOL_GATEWAY_URL` | Non | URL du Tool Gateway (defaut: `http://localhost:3002`) |
| `ANTHROPIC_API_KEY` | Oui | Cle API Anthropic pour le Claude Agent SDK |
