# 🏭 Motherson Aerospace — IT Automation Stack

**Kestra + ZeroClaw + Claude Desktop MCP**

Plateforme d'automatisation IT hybride combinant orchestration déterministe (Kestra)
et surveillance proactive par agent IA (ZeroClaw).

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    CLAUDE DESKTOP (MCP)                       │
│              Supervision humaine & pilotage                   │
│         Kestra MCP Server → gère flows/executions             │
└──────────────┬──────────────────────┬────────────────────────┘
               │                      │
    ┌──────────▼──────────┐  ┌────────▼───────────────────────┐
    │   KESTRA             │  │   ZEROCLAW AGENT               │
    │   "Le déterministe"  │  │   "L'intelligent"              │
    │                      │  │                                │
    │ • erp-health-check   │◄─┤ Heartbeat 5min:               │
    │ • erp-job-restart    │  │  • Analyse rapports santé      │
    │ • ad-maintenance     │  │  • Corrélation patterns        │
    │ • incident-escal-l2  │  │  • Décision L1/L2/L3          │
    │ • onboarding (TODO)  │  │  • Trigger flows Kestra        │
    │ • m365-audit (TODO)  │  │  • Notification Teams          │
    │                      │  │                                │
    │ Audit trail complet  │  │ Mémoire SQLite locale          │
    │ UI Dashboard         │  │ 3.4MB, <5MB RAM                │
    └──────────┬───────────┘  └───────┬────────────────────────┘
               │                      │
    ┌──────────▼──────────────────────▼────────────────────────┐
    │                   INFRASTRUCTURE                          │
    │   AD  │  M365  │  CEGID XRP  │  Sage X3  │  VMware      │
    └──────────────────────────────────────────────────────────┘
```

## Niveaux d'autonomie

| Niveau | Qui décide | Qui exécute | Validation | Exemple |
|--------|-----------|-------------|------------|---------|
| **L1** | Agent ZeroClaw | Kestra flow | Aucune (pré-approuvé) | Relance job ERP échoué |
| **L2** | Agent ZeroClaw propose | Kestra flow (après pause) | Humain via UI/Teams | Désactivation compte compromis |
| **L3** | Agent ZeroClaw recommande | Humain | N/A | "Ce job échoue chaque fin de mois, augmenter le timeout" |

## Quick Start

### Prérequis
- Docker & Docker Compose v2+
- ZeroClaw binary ([build instructions](https://github.com/zeroclaw-labs/zeroclaw#quick-start))
- Claude Desktop (pour MCP)
- Ollama (optionnel, pour LLM local)

### 1. Configuration

```bash
# Cloner le projet
cd motherson-it-automation

# Configurer les variables d'environnement
cp .env.template .env
# Éditer .env avec vos valeurs réelles

# Générer les webhook keys
for key in WEBHOOK_KEY_ERP_RESTART WEBHOOK_KEY_HEALTH_CHECK WEBHOOK_KEY_ESCALATION WEBHOOK_KEY_AD_MAINTENANCE; do
  echo "$key=$(openssl rand -hex 20)" >> .env
done
```

### 2. Démarrage

```bash
# Stack de base (Kestra + PostgreSQL + ZeroClaw)
docker compose up -d

# Avec LLM local (Ollama)
docker compose --profile local-llm up -d
docker exec ollama ollama pull qwen2.5-coder:14b
docker exec ollama ollama pull nomic-embed-text

# Avec monitoring (Prometheus + Grafana)
docker compose --profile monitoring up -d
```

### 3. Vérification

```bash
# Kestra UI
open http://localhost:8080
# Login: admin / (votre mot de passe .env)

# Vérifier les flows importés
curl -s http://localhost:8080/api/v1/flows | jq '.[] | .id'

# Statut ZeroClaw
docker exec motherson-it-automation-zeroclaw-erp-agent-1 zeroclaw status

# Test webhook ERP restart
curl -X POST "http://localhost:8080/api/v1/executions/webhook/motherson.it.erp/erp-job-restart/$(grep WEBHOOK_KEY_ERP_RESTART .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"erp_system":"cegid","job_name":"IMPORT_COMMANDES","failure_count":3,"agent_analysis":"3 échecs consécutifs timeout DB"}'
```

### 4. Claude Desktop MCP

Ajouter la config Kestra MCP dans Claude Desktop :

```bash
# Copier la config MCP
cat docs/claude_desktop_config.json
# → Intégrer dans votre claude_desktop_config.json
```

Ensuite dans Claude Desktop, vous pouvez :
- "Liste-moi les flows Kestra actifs"
- "Montre les dernières exécutions en erreur"
- "Déclenche un health check ERP maintenant"
- "Valide l'escalade en attente sur le ticket INC-..."

## Structure du projet

```
motherson-it-automation/
├── docker-compose.yml          # Stack complète
├── .env.template               # Variables d'environnement
├── kestra/
│   └── flows/
│       ├── erp-health-check.yml    # Surveillance ERP (cron 5min)
│       ├── erp-job-restart.yml     # Relance jobs ERP (webhook L1)
│       ├── incident-escalation-l2.yml  # Escalade incidents (L2)
│       └── ad-maintenance.yml      # Nettoyage AD (hebdo + webhook)
├── zeroclaw/
│   ├── config.toml             # Configuration agent
│   └── IDENTITY.md             # Persona agent IT
├── scripts/                    # Scripts de monitoring (TODO)
└── docs/
    ├── claude_desktop_config.json  # Config MCP Claude Desktop
    └── prometheus.yml              # Config Prometheus (TODO)
```

## Boucle de contrôle — Comment ça fonctionne

```
1. [Kestra] erp-health-check s'exécute toutes les 5 min (cron)
   → Collecte métriques CEGID, Sage X3, M365
   → Envoie le rapport au gateway ZeroClaw

2. [ZeroClaw] Reçoit le rapport + heartbeat LLM
   → Stocke en mémoire SQLite
   → Compare avec l'historique (patterns récurrents ?)
   → Corrèle avec d'autres signaux

3. [ZeroClaw] Détecte anomalie (ex: 3 échecs job consécutifs)
   → Décision: L1 (remédiation auto) ou L2 (escalade) ?

4a. [L1] Agent déclenche erp-job-restart via webhook
    → Kestra exécute le restart dans un container Docker isolé
    → Notification Teams automatique

4b. [L2] Agent déclenche incident-escalation-l2 via webhook
    → Kestra crée un ticket, notifie l'astreinte
    → PAUSE: attente validation humaine dans l'UI Kestra
    → L'opérateur valide (ou pas) depuis Claude Desktop (MCP)
    → Kestra exécute les actions approuvées
```

## Roadmap PoC → Production

### Phase 1 — PoC (2 semaines)
- [x] Architecture Kestra + ZeroClaw
- [x] Flows ERP monitoring
- [x] Agent config + identity
- [ ] Connexion réelle CEGID (remplacer les TODO)
- [ ] Connexion réelle Sage X3 (via X3-Oracle MCP existant)
- [ ] Test end-to-end sur environnement de dev

### Phase 2 — Pilote (1 mois)
- [ ] Intégration Microsoft Graph API (M365)
- [ ] Connexion AD réelle (PowerShell AD module)
- [ ] Flow onboarding/offboarding
- [ ] Dashboard Grafana temps réel
- [ ] Agent en mode L3 uniquement (observation + recommandation)

### Phase 3 — Production (2 mois)
- [ ] Activation progressive L1 (actions pré-approuvées)
- [ ] Intégration ServiceNow/GLPI
- [ ] Agent multicanal (Teams + Slack)
- [ ] Audit trail conformité EN9100
- [ ] Documentation opérationnelle
- [ ] Formation équipe IT

## Sécurité

- **ZeroClaw** : bind localhost, pairing requis, allowlist commandes, denylist stricte
- **Kestra** : auth basic, webhook keys uniques par flow, exécution Docker isolée
- **Données** : aucune donnée ERP/AD ne transite vers un LLM cloud (Ollama local)
- **Escalade** : principe 4-eyes via Kestra Pause (L2)
- **E-stop** : arrêt d'urgence agent avec OTP pour relance

## Licence

Projet interne Motherson Aerospace — Usage restreint.
