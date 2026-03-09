# infra/ — Infrastructure Docker Compose

Stack Docker de la plateforme **AutomIT** (Motherson Aerospace).
Orchestration Kestra + monitoring Grafana/Prometheus/Loki + gestion des secrets SOPS+age.

## Services

| Service | Image / Build | Port | Profile |
|---------|---------------|------|---------|
| **kestra** | `kestra/kestra:v0.21.1` | `127.0.0.1:8080` (UI), `:8081` (mgmt) | default |
| **postgres** | `postgres:16.6-alpine3.21` | interne uniquement | default |
| **control-plane** | `Dockerfile.control-plane` | `127.0.0.1:3001` | default |
| **tool-gateway** | `Dockerfile.tool-gateway` | `127.0.0.1:3002` | default |
| **ollama** | `ollama/ollama:0.5.7` (GPU) | `127.0.0.1:11434` | `local-llm` |
| **prometheus** | `prom/prometheus:v3.2.1` | `127.0.0.1:9090` | `monitoring` |
| **pushgateway** | `prom/pushgateway:v1.11.0` | `127.0.0.1:9091` | `monitoring` |
| **grafana** | `grafana/grafana:11.5.2` | `127.0.0.1:3000` | `monitoring` |
| **loki** | `grafana/loki:3.4.2` | `127.0.0.1:3100` | `monitoring` |

> Tous les ports sont bindés sur `127.0.0.1` (pas d'exposition réseau).

## Commandes

```bash
# Stack de base (Kestra + PostgreSQL + control-plane + tool-gateway)
docker compose -f infra/docker-compose.yml up -d

# Avec LLM local (Ollama, GPU NVIDIA)
docker compose -f infra/docker-compose.yml --profile local-llm up -d

# Avec monitoring (Prometheus + Pushgateway + Grafana + Loki)
docker compose -f infra/docker-compose.yml --profile monitoring up -d

# Health checks
curl -s http://localhost:8080/api/v1/health          # Kestra
docker compose -f infra/docker-compose.yml exec postgres pg_isready -U kestra
```

## Dockerfiles

- **Dockerfile.control-plane** — `node:22-slim`. Agent TypeScript (Claude SDK), tourne en user `node`. Port 3001.
- **Dockerfile.tool-gateway** — `python:3.12-slim` + ODBC 17 (SQL Server) + corporate CA. FastAPI (uvicorn), adapters GLPI/ERP/M365/AD, tourne en user `appuser`. Port 3002.

## Secrets — SOPS + age

Le fichier `.sops.yaml` configure le chiffrement des `.env` via [SOPS](https://github.com/getsops/sops) et [age](https://github.com/FiloSottile/age).

```bash
# Installation
winget install FiloSottile.age && winget install Mozilla.sops

# Generer une cle age
age-keygen -o ~/.config/sops/age/keys.txt
# Reporter la cle publique dans .sops.yaml (champ age:)

# Chiffrer
sops -e .env > .env.encrypted

# Dechiffrer
sops -d .env.encrypted > .env
```

## Grafana

Dashboards et datasources auto-provisionnés au demarrage via volume mounts :

- `grafana/provisioning/datasources/` — Prometheus + Loki
- `grafana/provisioning/dashboards/provider.yml` — provider de dashboards
- `grafana/dashboards/automit-overview.json` — dashboard principal (home)

## Docker Socket

Le service Kestra monte `/var/run/docker.sock` pour executer des tasks Docker (task runner).
C'est un **risque de securite connu** (equivalent root sur l'hote). Mitigation prevue : migration vers rootless Docker ou [docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy).
