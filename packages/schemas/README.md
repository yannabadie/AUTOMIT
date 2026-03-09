# @automit/schemas

Schemas Zod partages pour le typage cross-service de la plateforme AutomIT.

## Schemas

### ActionContract (`action-contract.ts`)

Contrat d'action complet pour les tiers L0-L3 :

- **Target** -- cible de l'action (`erp_job`, `ad_user`, `glpi_ticket`, `m365_user`, `mail`)
- **Requestor** -- demandeur GLPI (user ID, profile, entity, interface)
- **Approval** -- chaine d'approbation (`single`, `dual`, `breakglass`) avec validation GLPI optionnelle
- **AuditReceipt** -- resultat d'execution (timestamp, success/failure/partial, rollback)
- **ActionContract** -- schema principal : `action_id`, tier, target, `idempotency_key` (UUID), `ttl_seconds`, preconditions/postconditions, justification, evidence, `policy_basis`, requestor, approval et audit receipt optionnels

### TicketContext (`ticket-context.ts`)

Contexte ticket GLPI avec :

- **Followup** -- suivi (contenu, auteur, visibilite, date)
- **LinkedAsset** -- asset lie (type, id, nom)
- **TicketContext** -- ticket complet : urgency/impact/priority (1-5), requester, assigned technician, followups, linked assets, `ticket_hash`

### FullAuditReceipt (`audit-receipt.ts`)

Recu d'audit complet pour tracabilite EN9100 :

- **ApprovalRecord** -- approbation unitaire (approver GLPI ID, methode : `glpi_validation` | `kestra_pause` | `breakglass`)
- **FullAuditReceipt** -- `receipt_id` (UUID), action, target, requestor, tier, `approval_chain`, execution result, `glpi_followup_id` optionnel

## Usage

```typescript
import { ActionContractSchema, TicketContextSchema } from "@automit/schemas";

const contract = ActionContractSchema.parse(payload); // validation Zod
```

Importe par `control-plane`, valide aux frontieres API (entree/sortie).

## Commandes

| Commande | Description |
|----------|-------------|
| `npm run build` | Compilation TypeScript (`tsc` -> `dist/`) |
| `npm run typecheck` | Verification de types sans emission (`tsc --noEmit`) |

## Stack

- **Module** : ESM (`"type": "module"`)
- **TypeScript** : 5.7+, target ES2022, `moduleResolution: bundler`
- **Zod** : 3.24+
