# KumpeCloud Auth architecture

## What it is

KumpeCloud Auth is a monorepo fork of Logto — an OIDC/OAuth 2.1 identity provider with admin console, customizable sign-in experience, multi-tenancy, RBAC, organizations, enterprise SSO, and webhooks.

Upstream compatibility is intentional: `@logto/*` packages, Management API shapes, and OIDC flows match Logto unless Kumpe-specific behavior is documented in this skill.

## Runtime services

| Service | Dev port | Prod port | Role |
|---------|----------|-----------|------|
| Core (OIDC + APIs) | 3001 | 3001 | Token issuance, Management API, Experience API |
| Admin (Console SPA) | 3002 | 3002 | Tenant configuration UI |
| Experience (Vite) | 5001 | — (bundled in Core) | End-user sign-in/sign-up UI |
| Console (Vite) | 5002 | — (bundled in Core) | Admin UI dev server |
| PostgreSQL | 5432 | 5432 | Primary datastore |

`pnpm start:dev` runs Core + Vite dev servers. Production Docker image bundles built Console and Experience assets.

## Monorepo packages

| Package | Path | Notes |
|---------|------|-------|
| `@logto/core` | `packages/core` | Koa server, OIDC provider, route handlers |
| `@logto/console` | `packages/console` | React admin dashboard |
| `@logto/experience` | `packages/experience` | React sign-in experience |
| `@logto/schemas` | `packages/schemas` | Zod guards, DB table definitions, alterations |
| `@logto/cli` | `packages/cli` | Database, connectors, `amember sync` |
| `@logto/plugin-amember-sync` | `packages/plugin-amember-sync` | aMember inbound/outbound sync |
| `@logto/api` | `packages/api` | Management API client helpers |
| `@logto/connector-*` | `packages/connectors/` | Social/email/SMS connectors |

## Core concepts (Logto)

### Tenants

Multi-tenant by design. OSS/self-hosted uses tenant ID `default`. Cloud uses per-tenant subdomains. Management API resource indicator: `https://{tenantId}.kumpe.app/api`.

### Applications

Registered OIDC clients: Traditional web, SPA, Native, Machine-to-machine. Each has `appId`, redirect URIs, and optional custom metadata.

### Users and identities

Users have `id`, `username`, `primaryEmail`, `primaryPhone`, `name`, `avatar`, `profile` (custom fields), `customData` (JSON), `identities` (social), `roles`, `organizations`.

### Roles and scopes

- **User roles** — assigned to human users; aMember product roles use `{productId}: {title}` naming.
- **Machine-to-machine roles** — for service accounts.
- **Scopes** — permissions on API resources; included in access tokens when requested.

### API resources

Protected APIs registered in console. Access tokens include `aud` (resource indicator) and requested scopes. Built-in Management API is pre-seeded.

### Sign-in experience

Per-tenant configuration: identifiers (email, username, phone), password policy, social connectors, MFA, branding, custom profile fields. Served by Experience app.

### Organizations

Optional B2B feature: orgs, members, org roles, invitations, JIT SSO provisioning.

### JWT customization

Custom scripts can modify access token claims. `blockIssuanceOnError` requires `DEV_FEATURES_ENABLED`.

## Kumpe fork modifications

### Rebranding

- UI shows "KumpeCloud Auth" (console, experience footer option, docs).
- Management API product name: "KumpeCloud Management API".
- Me API product name: "KumpeCloud Me API".

### Management API host suffix

`packages/schemas/src/constants/management-api.ts`:

```typescript
export const managementApiHostSuffix = 'kumpe.app';
// Indicator: https://{tenantId}.kumpe.app/api
```

DB alteration `next-1785000000-rebrand-management-api-to-kumpecloud.ts` migrates existing indicators from `.logto.app`.

### aMember sync

Major Kumpe-specific feature. See [amember-sync.md](amember-sync.md).

Integration points in core:

| Location | Role |
|----------|------|
| `packages/core/src/libraries/amember-sync/` | Scheduler, per-user sync, outbound push |
| `packages/core/src/routes/logto-config/amember-sync.ts` | Config CRUD, test connection, run sync |
| `packages/core/src/routes/admin-user/amember-sync.ts` | Per-user sync (Management API) |
| `packages/core/src/routes/account/amember-sync.ts` | Self-service sync (User API) |
| `packages/core/src/libraries/sign-in-experience/` | Injects aMember sign-up requirements |
| `packages/core/src/routes/experience/classes/libraries/provision-library.ts` | Provisions aMember user on signup |
| `packages/console/src/pages/TenantSettings/AMemberSync/` | Console configuration UI |

### DEV_FEATURES_ENABLED

Env var `DEV_FEATURES_ENABLED=1` unlocks unreleased OSS features (JWT error handling tab, adaptive MFA, etc.). Set in prod `docker-compose.yml`. Gated in code via `EnvSet.values.isDevFeaturesEnabled` / `isDevFeaturesEnabled` in frontends.

### Docker images

`ghcr.io/kumpecloud/kumpecloud-auth:stable` (prod releases), `:edge` (main/staging), `:latest`.

## Database

PostgreSQL. Schema managed by alterations in `packages/schemas/alterations/`. On deploy:

```bash
pnpm cli db seed -- --swe --dapc
pnpm cli db alteration deploy latest
pnpm cli db alteration deploy next
```

## OIDC flow (simplified)

```text
App → redirect to Experience (/oidc/auth)
    → user authenticates
    → redirect back with ?code=
    → App POST /oidc/token (code + client_secret or PKCE)
    → access_token + id_token + refresh_token
```

Discovery: `GET {ENDPOINT}/oidc/.well-known/openid-configuration`

## Where to look in code

| Question | Start here |
|----------|------------|
| OIDC token claims | `packages/core/src/oidc/` |
| Experience sign-in flow | `packages/core/src/routes/experience/` |
| Management API routes | `packages/core/src/routes/` |
| User CRUD | `packages/core/src/routes/admin-user/` |
| Sign-in experience config | `packages/core/src/libraries/sign-in-experience/` |
| aMember sync logic | `packages/plugin-amember-sync/src/` |
| DB types | `packages/schemas/src/types/` |

## Development conventions

See repo root `AGENTS.md`:

- `pnpm prepack` before commit if lint-staged fails on stale builds.
- New unreleased features: guard with `isDevFeaturesEnabled`, no changeset until flag removed.
- Released features: add `.changeset` via `pnpm changeset`.
