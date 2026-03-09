# docs/ -- Documentation AutomIT

## ADR (Architecture Decision Records)

| ADR | Titre | Resume |
|-----|-------|--------|
| [ADR-001](adr/ADR-001-target-architecture.md) | Target Architecture | Architecture hybride 3 tiers : GLPI plugin (PHP) + control plane TS + tool gateway Python |
| [ADR-002](adr/ADR-002-typescript-control-plane.md) | TypeScript Control Plane | Claude Agent SDK en mode `dontAsk` avec `allowedTools` pour surface d'attaque minimale |
| [ADR-003](adr/ADR-003-sops-age-secrets.md) | SOPS+age Secrets | Chiffrement des secrets avec SOPS+age, versionnable dans git sans serveur externe |
| [ADR-004](adr/ADR-004-dual-approval-model.md) | Dual Approval Model | Approbation primaire via GLPI, fallback Kestra Pause pour conformite EN9100 |
| [ADR-005](adr/ADR-005-zeroclaw-removal.md) | ZeroClaw Removal | Suppression de l'agent Rust, remplace par le control plane TS |

## plans/

Contient les plans de conception et d'implementation classes par date :

- **Phase 1-3** (2026-02-26) : Cleanup, ameliorations, fonctionnalites avancees
- **First real deployment** (2026-02-27) : Premier deploiement reel + design Grafana v2
- **AutomIT v2** (2026-03-09) : Design et plan d'implementation de l'architecture v2

## runbooks/

Repertoire reserve pour les runbooks operationnels (procedures de maintenance,
gestion d'incidents, restauration). A remplir lors de la mise en production.
