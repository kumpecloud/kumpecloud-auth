# aMember sync

Bidirectional sync between [aMember Pro](https://www.amember.com/) billing and KumpeCloud Auth. Implemented in `@logto/plugin-amember-sync`, integrated into core.

## Architecture

| Direction | Transport | Purpose |
|-----------|-----------|---------|
| **Inbound** (aMember → Auth) | MySQL/MariaDB (recommended) or REST API | Bulk read products, users, access, password hashes |
| **Outbound** (Auth → aMember) | REST API only | Safe writes via aMember business logic |

Configure in Console → **Settings → aMember sync** (tenant settings). Console config overrides environment variables when enabled.

## What syncs

### Inbound

| aMember source | KumpeCloud Auth target |
|----------------|------------------------|
| Products | User roles named `{product_id}: {title}` (description = product title) |
| Users (email/login + password hash) | Users matched by `customData.amember.userId`, email, or username (`login`) |
| Active access records | Role assignments on matching user |

Only roles matching `{product_id}: {title}` or legacy `aMember: {product_id}` are managed by product/access sync.

**Password hashes**: optional import when `syncPasswords` enabled.

**User deletion**: optional `deleteLogtoUsersWhenRemovedFromAMember` removes Logto users when linked aMember account is deleted.

### Outbound

| Auth event | aMember action |
|------------|----------------|
| User signup | `POST /users` (login, email, profile, plaintext password) |
| Profile / custom data update | `PUT /users/{id}` |
| Password change | `PUT /users/{id}` with `pass` |
| Manual role grant (two-way only) | `POST /access` with lifetime expiry `2037-12-31` |
| Manual role revocation (two-way only) | Expire matching access record |

### Role sync direction

| Mode | Inbound | Outbound roles |
|------|---------|----------------|
| `one_way` (default) | aMember access → Logto roles | Logto role changes **not** pushed to aMember |
| `two_way` | Same | Manual Logto grants/revocations update aMember access |

## Sign-up requirements (outbound enabled)

When outbound sync is configured, sign-up is augmented at runtime (not persisted to DB):

**Required identifiers**: email, username, password.

**Required profile fields** (synthetic, runtime-only):

- Full name (givenName + familyName)
- Date of birth (ISO format)
- Full address (street, city, state, ZIP)

Implemented in:

- `applyAMemberOutboundSignUpRequirements()` — identifiers + password
- `applyAMemberOutboundSignUpProfileFields()` — profile field catalog

**Critical behavior**: user creation **fails and rolls back** if aMember provisioning fails. Profile/password/role updates are best-effort async.

Error codes:

| Code | Meaning |
|------|---------|
| `user.amember_email_required` | Missing email on create |
| `user.amember_username_required` | Missing username on create |
| `user.amember_password_required` | Missing password on create |
| `user.amember_profile_required` | Missing required profile fields |
| `user.amember_provision_failed` | aMember API rejected user create |
| `user.amember_sync_not_configured` | Inbound sync not enabled |
| `user.amember_user_not_found` | No matching aMember user for per-user sync |

## User linkage

Stored in user `customData`:

```json
{
  "amember": {
    "userId": 12345
  }
}
```

Constant: `amemberCustomDataKey = 'amember'` in `packages/plugin-amember-sync/src/constants.ts`.

Matching order for inbound: `customData.amember.userId` → email → username (`login`).

## Product role naming

```typescript
// Current format
"{productId}: {title}"   // e.g. "42: Premium Plan"

// Legacy (still recognized)
"aMember: {productId}"
```

Helpers in `packages/plugin-amember-sync/src/constants.ts`:

- `buildProductRoleName(productId, title)`
- `isProductRoleName(roleName)`
- `parseProductIdFromRoleName(roleName)`

## Configuration

### Console UI sections

1. **General** — enable inbound, interval, password import, role sync direction, delete-on-remove
2. **Inbound** — mode (MySQL or API), credentials, table prefix (`am_` default)
3. **Outbound** — enable push, API URL + key

### Environment variables (fallback)

```bash
AMEMBER_SYNC_ENABLED=true
AMEMBER_SYNC_OUTBOUND_DISABLED=true   # outbound on by default; set to disable
AMEMBER_SYNC_ROLE_SYNC_MODE=one_way   # or two_way
AMEMBER_SYNC_TENANT_ID=default
AMEMBER_SYNC_INTERVAL_SECONDS=3600
AMEMBER_SYNC_SKIP_PASSWORDS=true

# Inbound (default: database)
AMEMBER_SYNC_INBOUND_MODE=database
AMEMBER_DATABASE_HOST=db.example.com
AMEMBER_DATABASE_PORT=3306
AMEMBER_DATABASE_USER=amember
AMEMBER_DATABASE_PASSWORD=secret
AMEMBER_DATABASE_NAME=amember
AMEMBER_TABLE_PREFIX=am_

# Outbound (+ inbound when mode=api)
AMEMBER_API_URL=https://billing.example.com/amember/api
AMEMBER_API_KEY=your-rest-api-key
```

### Network requirements

- Auth service must reach aMember MySQL over network (Nebula VPN, internal IP, shared Docker network).
- Use Console **Test MySQL connection** before enabling sync.
- `localhost` only works if MySQL is in the same container as auth.

### aMember API permissions (outbound)

API module enabled; key needs `users` (read/write) and `access` (read/write).

## Running sync

### Automatic

Core starts inbound scheduler on boot when enabled (`startAMemberSyncScheduler` in `packages/core/src/libraries/amember-sync/index.ts`). Interval from config (default 3600s). Outbound runs inline on user lifecycle events.

### Manual CLI

```bash
pnpm cli amember sync
pnpm cli amember sync --tenant default
```

### Manual API

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/configs/amember-sync/run` | Management API |
| POST | `/api/users/{userId}/amember-sync` | Management API |
| POST | `/api/my-account/amember-sync` | User token with `roles` scope |

Use per-user endpoints after granting access directly in aMember so users get Logto roles without waiting for scheduled sync.

## Outbound code paths

| Function | Trigger |
|----------|---------|
| `provisionCreatedUserToAMember` | User creation (blocking) |
| `pushUpdatedUserToAMember` | Profile/custom data update (async) |
| `pushUserPasswordToAMember` | Password change (async) |
| `pushUserRoleChangesToAMember` | Role grant/revoke when `two_way` (async) |

Called from experience submit, admin-user routes, and account routes.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| User missing product role | aMember access active? Role name matches `{id}: {title}`? Run per-user sync. |
| Sign-up fails with profile error | Outbound enabled — collect fullname, birthdate, address. |
| Sign-up fails with provision error | aMember API URL/key, API permissions, duplicate login/email in aMember. |
| Inbound sync silent | `enabled` false? MySQL reachable? Check core logs (`amember-sync`). |
| Password login fails after import | `syncPasswords` enabled? Hash algorithm compatible? |
| Role change not in aMember | `roleSyncMode` must be `two_way`; only product roles sync. |

## Package layout

```
packages/plugin-amember-sync/src/
├── sync.ts              # Full inbound sync orchestration
├── sync-user.ts         # Per-user inbound sync
├── outbound.ts          # Outbound push functions
├── sources/             # MySQL and API data sources
├── sinks/               # aMember REST API client
├── sign-up-requirements.ts
├── sign-up-profile-fields.ts
├── config.ts            # Env + stored config resolution
└── constants.ts         # Role naming, customData keys
```

Tests: `*.test.ts` alongside sources. README: `packages/plugin-amember-sync/README.md`.
