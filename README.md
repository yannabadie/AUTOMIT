# AutomIT — Plateforme d'Automatisation IT

**Motherson Aerospace** | Serre-Castet, France

Plateforme d'automatisation IT de production intégrant GLPI, orchestration Kestra et intelligence artificielle (Claude Agent SDK) pour la gestion proactive des incidents et des opérations IT.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GLPI (Ticket View)                       │
│               Plugin AutomIT (PHP)                           │
│         Lane A: Analyse & Draft  │  Lane B: Actions          │
└──────────────────┬──────────────────────────────────────────┘
                   │ HMAC-SHA256
┌──────────────────▼──────────────────────────────────────────┐
│              CONTROL PLANE (:3001)                            │
│              TypeScript + Claude Agent SDK                    │
│                                                              │
│  • Policy engine (tiers, cooldowns, emergency stop)          │
│  • Context assembler (ticket → LLM prompt)                   │
│  • Audit trail (receipt par action)                          │
│  • permissionMode: "dontAsk" + allowedTools                  │
└──────────────────┬──────────────────────────────────────────┘
                   │ HMAC-SHA256
┌──────────────────▼──────────────────────────────────────────┐
│              TOOL GATEWAY (:3002)                             │
│              Python FastAPI                                   │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ GLPI API │ │ ERP MCP  │ │ M365     │ │ Circuit        │  │
│  │ adapter  │ │ adapter  │ │ Graph API│ │ Breaker +      │  │
│  │          │ │ (CEGID,  │ │ adapter  │ │ Cooldown       │  │
│  │          │ │  X3)     │ │          │ │                │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────┘  │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│              KESTRA (:8080)                                   │
│              Orchestration déterministe                       │
│                                                              │
│  • erp-health-check (cron 5min)                              │
│  • erp-job-restart (webhook, jobs allowlistés)               │
│  • ad-onboarding / ad-offboarding (L2, 4-eyes EN9100)       │
│  • m365-audit (hebdo, pagination Graph API)                  │
│  • incident-escalation-l2 (ticket + pause humaine)           │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
    ┌────▼───┐    ┌────▼───┐    ┌────▼───┐    ┌────▼───┐
    │ CEGID  │    │ Sage   │    │ Active │    │ M365   │
    │ XRP    │    │ X3     │    │ Direct │    │ Graph  │
    │ (MCP)  │    │ (MCP)  │    │ ory    │    │ API    │
    └────────┘    └────────┘    └────────┘    └────────┘
```

## Taxonomie d'actions

| Tier | Type | Approbation | Exemples |
|------|------|-------------|----------|
| **T0** | Lecture seule | Aucune | Contexte ticket, statut ERP |
| **T1** | Ops ticket réversibles | Auto-approuvé | Ajout followup, changement statut |
| **T2** | Actions externes bornées | Validation GLPI | Restart job ERP, désactivation AD |
| **T3** | Destructif | Double validation (GLPI + Kestra) | Suppression compte, purge données |

## Quick Start

### Prérequis

- Docker & Docker Compose v2+
- Node.js 22+ (pour le control plane)
- Python 3.12+ (pour le tool gateway)

### 1. Configuration

```bash
# Cloner et configurer
cd AutomIT
cp .env.template .env

# Générer les webhook keys
for key in WEBHOOK_KEY_ERP_RESTART WEBHOOK_KEY_HEALTH_CHECK WEBHOOK_KEY_ESCALATION \
           WEBHOOK_KEY_AD_MAINTENANCE WEBHOOK_KEY_AD_ONBOARDING WEBHOOK_KEY_AD_OFFBOARDING \
           WEBHOOK_KEY_SELFTEST WEBHOOK_KEY_M365_AUDIT; do
  echo "$key=$(openssl rand -hex 20)" >> .env
done

# Générer les secrets d'authentification
echo "AUTOMIT_HMAC_SECRET=$(openssl rand -hex 32)" >> .env
echo "AUTOMIT_ADMIN_TOKEN=$(openssl rand -hex 32)" >> .env

# Remplir les autres variables dans .env (Kestra, Postgres, GLPI, Azure, etc.)
```

### 2. Démarrage

```bash
# Stack complète
docker compose -f infra/docker-compose.yml up -d

# Avec monitoring (Prometheus + Grafana + Loki)
docker compose -f infra/docker-compose.yml --profile monitoring up -d

# Avec LLM local (Ollama + GPU)
docker compose -f infra/docker-compose.yml --profile local-llm up -d
```

### 3. Vérification

```bash
# Health checks
curl -s http://localhost:8080/api/v1/health    # Kestra
curl -s http://localhost:3001/health            # Control Plane
curl -s http://localhost:3002/health            # Tool Gateway

# E2E smoke test
bash evals/e2e-test.sh

# Kestra UI
open http://localhost:8080
```

## Structure du projet

```
AutomIT/
├── apps/
│   ├── control-plane/          # TypeScript — Agent SDK + policy engine
│   └── glpi-plugin/            # PHP — Plugin GLPI (ticket panel, AJAX, CSS/JS)
├── services/
│   └── tool-gateway/           # Python FastAPI — Adaptateurs GLPI/ERP/M365
├── packages/
│   ├── schemas/                # Zod — ActionContract, TicketContext, AuditReceipt
│   └── policies/               # YAML — Tiers, cooldowns, rédaction
├── kestra/
│   └── flows/                  # 8 workflows YAML (cron + webhook)
├── infra/
│   ├── docker-compose.yml      # Stack complète (8 services)
│   ├── Dockerfile.*            # Images Docker (control-plane, tool-gateway)
│   ├── .sops.yaml              # Chiffrement secrets (SOPS+age)
│   └── grafana/, prometheus.yml, loki/
├── docs/
│   ├── adr/                    # 5 Architecture Decision Records
│   └── plans/                  # Design docs et plans d'implémentation
├── evals/                      # Scripts de test E2E
├── scripts/                    # Utilitaires (tests connectivité, etc.)
├── .github/workflows/          # CI: TruffleHog, Trivy, CodeQL, TypeCheck, Ruff
└── .env.template               # Template variables d'environnement
```

## Sécurité

- **Authentification HMAC-SHA256** entre tous les tiers (GLPI → Control Plane → Tool Gateway)
- **SOPS+age** pour le chiffrement des secrets au repos
- **Images Docker pinnées** sur des versions exactes (pas de `:latest`)
- **Ports restreints** à `127.0.0.1` (aucun port exposé sur le réseau)
- **CI automatisée** : TruffleHog (secrets), Trivy (vulnérabilités images), CodeQL (Python + JS)
- **Emergency stop** via endpoint `/kill` (token admin requis)
- **Circuit breaker** par adaptateur (5 échecs → ouverture 60s)
- **Cooldown registry** par action+cible (rate limiting)

## Documentation

| Document | Contenu |
|----------|---------|
| [CLAUDE.md](CLAUDE.md) | Instructions pour Claude Code |
| [ADR-001](docs/adr/ADR-001-target-architecture.md) | Architecture cible 3 tiers |
| [ADR-002](docs/adr/ADR-002-typescript-control-plane.md) | Control plane TypeScript |
| [ADR-003](docs/adr/ADR-003-sops-age-secrets.md) | Chiffrement SOPS+age |
| [ADR-004](docs/adr/ADR-004-dual-approval-model.md) | Double approbation GLPI + Kestra |
| [ADR-005](docs/adr/ADR-005-zeroclaw-removal.md) | Retrait de ZeroClaw |
| [Design v2](docs/plans/2026-03-09-automit-v2-design.md) | Design complet AutomIT v2 |
| [Plan v2](docs/plans/2026-03-09-automit-v2-implementation.md) | Plan d'implémentation détaillé |

## Licence

Projet interne Motherson Aerospace — Usage restreint.
