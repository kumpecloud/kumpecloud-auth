---
name: kumpeapps-auth
description: KumpeCloud Auth (Logto fork) domain expert for OIDC integration, aMember billing sync, roles/products, Management API, and KumpeApps deployment. Use when building or debugging apps that authenticate against KumpeCloud Auth, configuring sign-in experiences, syncing aMember products/access, calling the Management API, or working in the kumpecloud-auth repository.
---

# KumpeApps Auth

KumpeCloud Auth is KumpeApps' self-hosted identity platform — a fork of [Logto](https://github.com/logto-io/logto) with Kumpe-specific branding, deployment, and aMember billing sync. Internal package names (`@logto/*`) and APIs remain upstream-compatible unless noted below.

## When to use this skill

| Task | Read first |
|------|------------|
| Integrate OIDC/OAuth into another app | [references/app-integration.md](references/app-integration.md) |
| aMember products, access, roles, sign-up | [references/amember-sync.md](references/amember-sync.md) |
| Work in `kumpecloud-auth` repo | [references/architecture.md](references/architecture.md) |
| Prod/stage deploy, env vars, images | [references/deployment.md](references/deployment.md) |
| Local dev bootstrap | [logto-dev-environment](../logto-dev-environment/SKILL.md) |
| Avatar/file uploads in dev | [logto-local-storage](../logto-local-storage/SKILL.md) |

## Environments

| Environment | OIDC / API (`ENDPOINT`) | Admin console (`ADMIN_ENDPOINT`) |
|-------------|-------------------------|----------------------------------|
| Production | `https://auth.kumpe.app` | `https://auth-console.kumpe.app` |
| Staging | `https://auth.stage.kumpe.app` | `https://auth-console.stage.kumpe.app` |
| Local dev | `http://localhost:3001` | `http://localhost:3002` |

**Management API resource indicator** (for M2M tokens and `getAccessToken` audience) is **not** the auth URL:

```text
https://{tenantId}.kumpe.app/api
```

OSS / self-hosted default tenant ID is `default` → `https://default.kumpe.app/api`.

**Me API** (user account API): `https://{tenantId}.kumpe.app/me`

## Fork vs upstream Logto

| Area | Upstream | KumpeCloud Auth |
|------|----------|-----------------|
| Product name | Logto | **KumpeCloud Auth** |
| Docker image | `ghcr.io/logto-io/logto` | `ghcr.io/kumpecloud/kumpecloud-auth` |
| Management API indicator host | `*.logto.app` | `*.kumpe.app` |
| Billing sync | — | **aMember sync** (`@logto/plugin-amember-sync`) |
| Unreleased features | Cloud-only or absent | Gated by `DEV_FEATURES_ENABLED=1` |

Package names, env var names, and OIDC behavior match upstream unless this skill says otherwise.

## aMember sync (summary)

Hybrid sync between aMember billing and KumpeCloud Auth:

- **Inbound** (aMember → Auth): MySQL reads (recommended) or REST API — products become roles `{productId}: {title}`, active access becomes role assignments.
- **Outbound** (Auth → aMember): REST API — signups, profile/password updates, optional two-way role sync.

When outbound sync is enabled, user creation **requires** email, username, password, and profile fields (full name, birthdate, address). Failed aMember provisioning **rolls back** the Logto user.

User linkage stored in `customData.amember.userId`.

Full details: [references/amember-sync.md](references/amember-sync.md).

## Integrating consumer apps (summary)

1. Create an application in the admin console (Traditional web, SPA, Native, or M2M).
2. Set redirect URIs and post-logout redirect URIs for your app.
3. Use standard Logto SDKs (`@logto/react`, `@logto/node`, `@logto/next`, etc.) with `endpoint` set to the auth URL above.
4. For API access: create an API resource in console, request scopes, pass the resource indicator as audience.
5. For role-based access: check JWT claims or call Management API; product roles from aMember follow `{productId}: {title}` naming.

Full patterns: [references/app-integration.md](references/app-integration.md).

## Repository map (`kumpecloud-auth`)

| Path | Purpose |
|------|---------|
| `packages/core` | OIDC provider, Management API, experience routes, aMember hooks |
| `packages/console` | Admin SPA (port 5002 dev / 3002 prod) |
| `packages/experience` | Sign-in SPA (port 5001 dev) |
| `packages/plugin-amember-sync` | aMember sync plugin (inbound/outbound logic) |
| `packages/schemas` | DB schemas, types, alterations |
| `packages/cli` | `pnpm cli` — db seed, `amember sync`, connectors |
| `.kumpeapps-deploy-bot/` | Prod/stage Docker Compose + Caddy for kumpeapps-deploy-bot |

## Key commands

```bash
# Local dev (see logto-dev-environment skill for full bootstrap)
export DB_URL="postgres://postgres:p0stgr3s@localhost:5432/logto"
pnpm start:dev

# Manual aMember inbound sync
pnpm cli amember sync
pnpm cli amember sync --tenant default

# Rebuild after package changes (pre-commit may require this)
pnpm prepack
```

## API quick reference

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /oidc/token` | Client credentials / auth code | Token issuance |
| `GET /oidc/.well-known/openid-configuration` | Public | OIDC discovery |
| `POST /api/configs/amember-sync/run` | Management API | Full inbound sync |
| `POST /api/users/{userId}/amember-sync` | Management API | Sync one user's aMember access |
| `POST /api/my-account/amember-sync` | User token (`roles` scope) | Self-service access sync |

## Agent behavior

When helping with KumpeApps auth:

1. **Prefer KumpeCloud Auth terminology** in user-facing copy; use "Logto" only when referring to upstream docs or `@logto/*` packages.
2. **Distinguish endpoint URLs** — `auth.kumpe.app` for OIDC vs `default.kumpe.app/api` for Management API tokens.
3. **Check aMember sync state** when debugging sign-up failures, missing roles, or password/profile errors.
4. **For auth repo changes**, follow `AGENTS.md` (changesets vs `isDevFeaturesEnabled`, commit hooks, `pnpm prepack`).
5. **Read reference files** before deep implementation — do not guess sync behavior or role naming.

## Import into other repos

Copy or submodule this skill folder into the target repo's `.agents/skills/kumpeapps-auth/` (or `.cursor/skills/kumpeapps-auth/`). See [IMPORT.md](IMPORT.md).
