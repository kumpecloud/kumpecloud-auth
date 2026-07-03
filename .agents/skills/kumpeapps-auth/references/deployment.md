# KumpeCloud Auth deployment

## Overview

KumpeCloud Auth deploys via **kumpeapps-deploy-bot** using Docker Compose configs in `.kumpeapps-deploy-bot/`. Caddy reverse-proxies public domains to the VM Nebula IP.

## Environments

| Env | Domains | Image tag | Trigger |
|-----|---------|-----------|---------|
| Production | `auth.kumpe.app`, `auth-console.kumpe.app` | `stable` | GitHub release (non-prerelease) |
| Staging | `auth.stage.kumpe.app`, `auth-console.stage.kumpe.app` | `edge` | Push to `main` |
| Dev | `*.dev.kumpe.app` (per repo) | varies | Manual via deploy-bot |

## Docker image

```bash
docker pull ghcr.io/kumpecloud/kumpecloud-auth:stable   # production
docker pull ghcr.io/kumpecloud/kumpecloud-auth:edge      # staging / main
docker pull ghcr.io/kumpecloud/kumpecloud-auth:latest
```

Override with `KUMPECLOUD_AUTH_TAG` env var.

## Production stack

File: `.kumpeapps-deploy-bot/prod/docker-compose.yml`

Services:

- **postgres** — PostgreSQL 17, database `logto`
- **kumpecloud-auth** — Core + bundled Console/Experience

Key environment variables:

| Variable | Source | Purpose |
|----------|--------|---------|
| `POSTGRES_PASSWORD` | `PROD_AUTH_POSTGRES_PASSWORD` secret | DB password |
| `AUTH_ENDPOINT` | `PROD_AUTH_ENDPOINT` secret | Public OIDC URL (`https://auth.kumpe.app`) |
| `ADMIN_ENDPOINT` | `PROD_AUTH_ADMIN_ENDPOINT` secret | Admin console URL |
| `DB_URL` | Composed from postgres password | Internal connection string |
| `TRUST_PROXY_HEADER` | `1` | Behind Caddy |
| `DEV_FEATURES_ENABLED` | `1` | Unreleased OSS features |
| `SECRET_VAULT_KEK` | `PROD_SECRET_VAULT_KEK` | Secret vault encryption |
| `PRIVATE_KEY_ROTATION_GRACE_PERIOD` | optional | OIDC key rotation |

Startup entrypoint:

```bash
npm run cli db seed -- --swe --dapc && \
npm run cli db alteration deploy latest && \
npm run cli db alteration deploy next && \
exec npm start
```

Ports exposed on VM (Caddy proxies to Nebula IP):

- `3001` — OIDC / API / Experience
- `3002` — Admin console

## Caddy

Prod `.kumpeapps-deploy-bot/prod/caddyfile`:

```caddyfile
auth.kumpe.app {
    import ssl_defaults
    reverse_proxy {{nebula.ip}}:3001
}

auth-console.kumpe.app {
    import ssl_defaults
    reverse_proxy {{nebula.ip}}:3002
}
```

Staging uses `auth.stage.kumpe.app` and `auth-console.stage.kumpe.app`.

## Deploy-bot config

Prod: `.kumpeapps-deploy-bot/prod/prod.yml`

```yaml
deployment_type: docker
domains:
  - auth.kumpe.app
  - auth-console.kumpe.app
docker_compose: docker-compose.yml
env_mappings:
  NEBULA_CLIENT_TOKEN: PROD_NEBULA_CLIENT_TOKEN
  POSTGRES_PASSWORD: PROD_AUTH_POSTGRES_PASSWORD
  SECRET_VAULT_KEK: PROD_SECRET_VAULT_KEK
  AUTH_ENDPOINT: PROD_AUTH_ENDPOINT
  ADMIN_ENDPOINT: PROD_AUTH_ADMIN_ENDPOINT
deploy_rules:
  - environment: prod
    release:
      types: [published]
      exclude_prerelease: true
```

Staging: `.kumpeapps-deploy-bot/stage/stage.yml` — deploys on `main` push, uses `STAGE_*` secrets.

Post-deploy hook starts Nebula VPN client after app services.

## Required GitHub secrets

Synced via `.github/workflows/sync-secrets.yml`:

| Secret | Used for |
|--------|----------|
| `PROD_AUTH_POSTGRES_PASSWORD` | Production DB |
| `PROD_AUTH_ENDPOINT` | Production OIDC URL |
| `PROD_AUTH_ADMIN_ENDPOINT` | Production admin URL |
| `PROD_SECRET_VAULT_KEK` | Production secret vault |
| `PROD_NEBULA_CLIENT_TOKEN` | Production VPN |
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

Docker healthcheck uses internal `http://127.0.0.1:3001/api/status`.

## Importing deploy patterns to other apps

Other KumpeApps repos use the same `.kumpeapps-deploy-bot/{env}/` layout:

1. `docker-compose.yml` — services
2. `{env}.yml` — deploy-bot config (domains, secrets, rules)
3. `caddyfile` — reverse proxy to `{{nebula.ip}}:PORT`

See `.kumpeapps-deploy-bot/prod/prod-example.yml.template` for a generic template.

Consumer apps that only **use** auth (not deploy it) need OIDC env vars — see [app-integration.md](app-integration.md).
