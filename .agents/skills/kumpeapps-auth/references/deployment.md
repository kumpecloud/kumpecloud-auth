# KumpeCloud Auth deployment

## Overview

KumpeCloud Auth deploys via **kumpeapps-deploy-bot** using Docker Compose configs in `.kumpeapps-deploy-bot/`. Caddy reverse-proxies public domains to the VM Nebula IP.

Production can run as a **single node** (default) or as **two-node HA**: active-active Logto behind edge Caddy round-robin, with a single Postgres writer and a streaming standby that auto-promotes and auto-rejoins.

## Environments

| Env | Domains | Image tag | Trigger |
|-----|---------|-----------|---------|
| Production (Node A) | `auth.kumpe.app`, `auth-console.kumpe.app` | `stable` | GitHub release (non-prerelease) |
| Production (Node B) | same (edge HA Caddy) | `stable` | GitHub release (non-prerelease) |
| Staging | `auth.stage.kumpe.app`, `auth-console.stage.kumpe.app` | `edge` | Push to `main` |
| Dev | `*.dev.kumpe.app` (per repo) | varies | Manual via deploy-bot |

## Docker image

```bash
docker pull ghcr.io/kumpecloud/kumpecloud-auth:stable   # production
docker pull ghcr.io/kumpecloud/kumpecloud-auth:edge      # staging / main
docker pull ghcr.io/kumpecloud/kumpecloud-auth:latest
```

Override with `KUMPECLOUD_AUTH_TAG` env var.

## Production stack (Node A)

File: `.kumpeapps-deploy-bot/prod/docker-compose.yml`

Services:

- **postgres** — PostgreSQL 17 (`ha-entrypoint` enables replication when peer env is set)
- **failover-watch** — promotes local DB if peer primary is unreachable
- **kumpecloud-auth** — Core + bundled Console/Experience

Key environment variables:

| Variable | Source | Purpose |
|----------|--------|---------|
| `POSTGRES_PASSWORD` | `PROD_AUTH_POSTGRES_PASSWORD` | DB password |
| `AUTH_ENDPOINT` | `PROD_AUTH_ENDPOINT` | Public OIDC URL |
| `ADMIN_ENDPOINT` | `PROD_AUTH_ADMIN_ENDPOINT` | Admin console URL |
| `SECRET_VAULT_KEK` | `PROD_SECRET_VAULT_KEK` | Secret vault encryption |
| `PEER_POSTGRES_IP` | `PROD_AUTH_PEER_POSTGRES_IP_B` | Node B Nebula IP (HA) |
| `POSTGRES_HOST_IPS` | `PROD_AUTH_POSTGRES_HOST_IPS` | Both Nebula IPs, comma-separated (HA) |
| `POSTGRES_REPLICATION_PASSWORD` | `PROD_AUTH_POSTGRES_REPLICATION_PASSWORD` | Streaming replication (HA) |

Without the HA secrets, Node A behaves as a single-node deploy (empty peer = HA disabled).

## Two-node HA / round-robin

```text
Edge Caddy (literal Nebula IPs)
   round_robin → Node A :3001/:3002
               → Node B :3001/:3002

Node A                              Node B
Logto + Postgres (writer or standby)   Logto + Postgres (standby or writer)
        ◄──────── WAL streaming ────────►
```

- **One Postgres writer** at a time (streaming physical replication). Never two writers.
- **Both Logto processes** stay up. The auth entrypoint probes each host in order and sets `DB_URL` to a **single** writable host (node-pg does not reliably support libpq multi-host / `target_session_attrs`).
- **Auto-promote**: `failover-watch` on the standby promotes after consecutive peer failures.
- **Auto-rejoin**: when a downed node returns, `ha-entrypoint` sees the peer primary and runs `pg_basebackup` to clone it back as a standby.
- **pg_hba**: replication is limited to peer `/32`s (and optional `POSTGRES_HBA_ALLOWED_CIDRS`). Never `0.0.0.0/0`.

### Enable HA

1. Provision VM `prod-vm-kumpecloud-auth-b` (see `prod-secondary/prod-secondary.yml`).
2. Set GitHub / bot secrets (literal Nebula IPs, no DNS). Required secrets:

   - `PROD_AUTH_POSTGRES_REPLICATION_PASSWORD` — long random
   - `PROD_AUTH_POSTGRES_HOST_IPS` — e.g. `10.10.0.11,10.10.0.12`
   - `PROD_AUTH_PEER_POSTGRES_IP_A` — Node A Nebula IP (for Node B)
   - `PROD_AUTH_PEER_POSTGRES_IP_B` — Node B Nebula IP (for Node A)
   - `PROD_SECONDARY_NEBULA_CLIENT_TOKEN` — Nebula token for Node B

3. Deploy Node A with HA env set (replication user is created/ensured by `failover-watch` / init script).
4. Deploy Node B (`.kumpeapps-deploy-bot/prod-secondary/`) — empty volume auto-clones from A.
5. Point **edge** Caddy at both IPs using `.kumpeapps-deploy-bot/caddy/edge-ha.caddyfile.example`. Prefer this over per-VM sole ownership of `auth.kumpe.app`.

Scripts live under `.kumpeapps-deploy-bot/postgres/` and `.kumpeapps-deploy-bot/scripts/` (deploy-only; no Logto core / MariaDB fork). Shared helpers are in `postgres/ha-common.sh`.

### Failover and failback

| Event | Behavior |
|-------|----------|
| Node A down | Node B `failover-watch` promotes; restart auth on B if it still points at A’s dead writer (entrypoint re-probes hosts on start); Caddy drops A |
| Node A returns | `ha-entrypoint` reclones A as standby via `pg_basebackup`; A Logto healthy again after it re-resolves the writer; round-robin resumes |
| Split-brain | Logged as CRITICAL; Node B (`NODE_PRIORITY=50`) should restart `postgres` so it rejoins; Node A (`100`) keeps writer |

Same `SECRET_VAULT_KEK`, endpoints, and app password on both nodes. Firewall Postgres `5432` to peer Nebula IPs only.

## Caddy

Per-VM snippets still use `{{nebula.ip}}`. For HA, use the edge example with **both Nebula IPs** and `lb_policy round_robin` (or `first` for prefer-primary).

## Deploy-bot config

- Node A: `.kumpeapps-deploy-bot/prod/prod.yml`
- Node B: `.kumpeapps-deploy-bot/prod-secondary/prod-secondary.yml`

Post-deploy hook starts Nebula VPN client after app services.

## Required GitHub secrets

Synced via `.github/workflows/sync-secrets.yml`:

| Secret | Used for |
|--------|----------|
| `PROD_AUTH_POSTGRES_PASSWORD` | Production DB |
| `PROD_AUTH_ENDPOINT` | Production OIDC URL |
| `PROD_AUTH_ADMIN_ENDPOINT` | Production admin URL |
| `PROD_SECRET_VAULT_KEK` | Production secret vault |
| `PROD_NEBULA_CLIENT_TOKEN` | Production VPN (Node A) |
| `PROD_AUTH_POSTGRES_REPLICATION_PASSWORD` | HA replication (optional until Node B) |
| `PROD_AUTH_POSTGRES_HOST_IPS` | HA multi-IP DB URL |
| `PROD_AUTH_PEER_POSTGRES_IP_A` / `_B` | HA peer IPs |
| `PROD_SECONDARY_NEBULA_CLIENT_TOKEN` | Production VPN (Node B) |
| `STAGE_AUTH_POSTGRES_PASSWORD` | Staging DB |
| `STAGE_SECRET_VAULT_KEK` | Staging secret vault |
| `STAGE_NEBULA_CLIENT_TOKEN` | Staging VPN |

## Releases

`.github/workflows/release.yml` builds and publishes Docker images to `ghcr.io/kumpecloud/kumpecloud-auth` on version tags.

Tag pattern: semver (e.g. `v1.2.3`). Production deploy-bot watches GitHub releases.

## aMember connectivity in deployed environments

Auth containers reach aMember MySQL via Nebula VPN or internal network — not `localhost` unless co-located.

Configure aMember sync in production console (Settings → aMember sync) with:

- MySQL host reachable from auth container (aMember server internal IP or VPN address)
- aMember REST API URL + key for outbound

Test MySQL connection from console before enabling inbound sync.

## Local Docker (quick start)

Repo root `docker compose up` — upstream-compatible quick start on ports 3001/3002. For development, prefer `pnpm start:dev` per `logto-dev-environment` skill.

## Health check

```bash
curl -sf https://auth.kumpe.app/api/status
# or locally:
curl -sf http://localhost:3001/api/status
```

Docker healthcheck uses internal `http://127.0.0.1:3001/api/status`. Auth entrypoint waits for a **writable** Postgres before starting.

## Optional Redis

For multi-instance OIDC config cache coherence, set the same `REDIS_URL` on both nodes (Logto central cache). Login/tokens work from shared Postgres alone; Redis is recommended once you run round-robin day-to-day.

## Importing deploy patterns to other apps

Other KumpeApps repos use the same `.kumpeapps-deploy-bot/{env}/` layout:

1. `docker-compose.yml` — services
2. `{env}.yml` — deploy-bot config (domains, secrets, rules)
3. `caddyfile` — reverse proxy to `{{nebula.ip}}:PORT`

See `.kumpeapps-deploy-bot/prod/prod-example.yml.template` for a generic template.

Consumer apps that only **use** auth (not deploy it) need OIDC env vars — see [app-integration.md](app-integration.md).
