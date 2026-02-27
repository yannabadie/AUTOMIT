# Grafana Dashboard v2 — Design Document

## Problem
The current dashboard has 33 panels but most are useless: fake license counts (1M), dead panels (staleness, backup, sessions), MCP latency nobody checks, and no incident visibility. IT Ops needs to see "what do I need to handle right now" in 3 seconds.

## Audience
IT Operations team (2-3 people), daily morning check.

## Design: "Incidents First" Dashboard

### Section 1: "A traiter maintenant" (top)
- Executions en echec (24h) — stat, red if >0
- L2 en attente d'approbation — stat, orange if >0
- Alertes securite M365 — stat, red if >0
- Utilisateurs a risque — stat, red if >0
- Derniere verification — stat, timestamp

### Section 2: "Etat des systemes" (middle)
- CEGID / Sage X3 / M365 — traffic light stats (0/1/2)
- Sante globale (24h) — timeseries trend

### Section 3: "Details" (bottom)
- Licences M365 payantes — table par SKU (nom, total, utilisees, dispo, %)
- Licences M365 gratuites — stat (total assigne)
- Jobs CEGID echoues — stat

### Metrics to fix
- Split licenses: paid vs free SKUs (filter ENTERPRISEPACK, STANDARDPACK, SPE_F1)
- Add: automit_m365_risky_users_count, automit_m365_users_without_mfa
- Remove: staleness, backup, sessions, MCP latency panels

### Panels to remove
- CEGID sessions, staleness, backup age (never pushed)
- MCP response time (not operationally useful)
- Kestra timeseries (not scraped correctly)
- M365 licenses total/assigned (wrong calculation)
