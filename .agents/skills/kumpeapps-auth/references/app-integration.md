# App integration with KumpeCloud Auth

Guide for consumer applications (web, mobile, backend) authenticating against KumpeCloud Auth. Uses standard Logto SDKs — KumpeCloud Auth is OIDC-compatible.

## Endpoints by environment

| Environment | `endpoint` (SDK config) | Admin console |
|-------------|-------------------------|---------------|
| Production | `https://auth.kumpe.app` | `https://auth-console.kumpe.app` |
| Staging | `https://auth.stage.kumpe.app` | `https://auth-console.stage.kumpe.app` |
| Local | `http://localhost:3001` | `http://localhost:3002` |

## Step 1: Register the application

In admin console → **Applications** → Create application.

| App type | Use when |
|----------|----------|
| Traditional web | Server-rendered app with backend session (Next.js pages, Express) |
| Single-page app | Browser-only (React, Vue) — uses PKCE |
| Native | Mobile/desktop (Expo, Swift, etc.) |
| Machine-to-machine | Backend service, cron, no user login |

Record:

- **App ID** (`appId`) — OIDC client_id
- **App secret** — for confidential clients (Traditional, M2M); never in frontend

Configure **Redirect URIs** (exact match required) and **Post sign-out redirect URIs**.

## Step 2: Install SDK

Logto maintains framework SDKs (npm package names unchanged):

| Framework | Package |
|-----------|---------|
| React | `@logto/react` |
| Next.js (App Router) | `@logto/next` |
| Node / Express | `@logto/node` |
| React Router | `@logto/react-router` |
| Vue | `@logto/vue` |
| Expo / React Native | `@logto/rn` |
| Python | `logto` (PyPI) |
| Go, Java, etc. | OIDC libraries against discovery URL |

## Step 3: Configure the SDK

### React SPA example

```typescript
import { LogtoProvider } from '@logto/react';

const config = {
  endpoint: 'https://auth.kumpe.app',       // or staging/local
  appId: 'your-app-id',
  scopes: ['openid', 'profile', 'email', 'offline_access'],
  // resources: ['https://your-api.example.com/api'],  // if calling a custom API
};

<LogtoProvider config={config}>
  <App />
</LogtoProvider>
```

### Next.js

Use `@logto/next` with `LOGTO_ENDPOINT`, `LOGTO_APP_ID`, `LOGTO_APP_SECRET`, `LOGTO_COOKIE_SECRET` env vars. See Logto docs for App Router vs Pages Router setup.

### Machine-to-machine

```bash
curl -X POST 'https://auth.kumpe.app/oidc/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -u 'APP_ID:APP_SECRET' \
  -d 'grant_type=client_credentials' \
  -d 'resource=https://default.kumpe.app/api' \
  -d 'scope=all'
```

**Important**: Management API resource is `https://{tenantId}.kumpe.app/api`, not the auth endpoint URL.

## Step 4: Sign-in flow

```typescript
import { useLogto } from '@logto/react';

const { signIn, signOut, isAuthenticated, getAccessToken, getIdTokenClaims } = useLogto();

// Redirect to sign-in
await signIn('https://your-app.com/callback');

// After callback, get tokens
const token = await getAccessToken('https://your-api.example.com/api');
const claims = await getIdTokenClaims();
```

Callback route must exchange the authorization code (SDK handles this).

## Step 5: Protect APIs

### Option A: JWT validation (recommended)

Validate access tokens on your API:

1. Fetch JWKS from `{endpoint}/oidc/jwks`
2. Verify signature, `iss` = `{endpoint}/oidc`, `aud` = your API resource indicator
3. Check `exp`, optional `scope` / custom claims

### Option B: Opaque token introspection

Logto supports opaque API tokens via `client.getAccessToken()` — validate through Logto token introspection or userinfo depending on setup.

### Option C: Management API for user lookup

M2M token with Management API resource → `GET /api/users/{id}`.

## API resources and scopes

1. Console → **API resources** → Create resource with indicator (e.g. `https://api.myapp.com`).
2. Define scopes (permissions).
3. Console → **Roles** → assign scopes to roles.
4. Assign roles to users (or rely on aMember-synced product roles).
5. Request resource in SDK: `resources: ['https://api.myapp.com']` and scopes in `scopes` array.

Access token `aud` will be the resource indicator; `scope` claim lists granted scopes.

## Roles and aMember product access

When aMember inbound sync runs, active product access becomes Logto **user roles** named `{productId}: {title}`.

In your app:

```typescript
// After sign-in, fetch roles via Management API or custom JWT claim
// Or use getAccessToken with appropriate scopes and check permissions
```

To refresh roles after aMember purchase without waiting for scheduled sync:

```bash
# Management API (admin)
POST /api/users/{userId}/amember-sync

# User self-service (requires roles scope on user token)
POST /api/my-account/amember-sync
```

## Common integration patterns

### Check if user has product access

1. List user roles via Management API: `GET /api/users/{userId}/roles`
2. Match role name against `parseProductIdFromRoleName()` pattern or string prefix `{productId}:`
3. Or map product IDs to roles in your app config

### Multi-tenant apps

Default OSS tenant is `default`. Management API indicator: `https://default.kumpe.app/api`. User tokens are tenant-scoped.

### Sign-out

```typescript
await signOut('https://your-app.com/');
```

### Local dev against localhost auth

```typescript
endpoint: 'http://localhost:3001',
```

Create a separate dev application in local console with `http://localhost:PORT/callback` redirect URIs.

## Environment variables template

```bash
# Web / Next.js
LOGTO_ENDPOINT=https://auth.kumpe.app
LOGTO_APP_ID=abc123
LOGTO_APP_SECRET=secret          # server-side only
LOGTO_BASE_URL=https://myapp.com
LOGTO_COOKIE_SECRET=random_32+_chars

# API resource (if applicable)
LOGTO_API_RESOURCE=https://api.myapp.com
```

Use staging endpoints in non-prod deployments.

## Security checklist

- [ ] Redirect URIs are exact-match, no wildcards in production
- [ ] App secret only on server (Traditional web, M2M)
- [ ] SPA uses PKCE (SDK default)
- [ ] Validate JWT `iss`, `aud`, `exp` on API
- [ ] Use HTTPS in production
- [ ] Request minimum scopes needed

## Upstream documentation

Logto integration guides in `packages/console/src/assets/docs/guides/` mirror upstream patterns. Replace Logto Cloud endpoints with KumpeCloud Auth URLs and use `*.kumpe.app/api` for Management API resources.

Official Logto docs: https://docs.logto.io/ — applicable for SDK usage; substitute endpoints and Management API host suffix.
