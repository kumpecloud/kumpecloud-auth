# @logto/plugin-amember-sync

Sync aMember products, users, and access records into Kumpecloud Auth (Logto fork).

## What it syncs

| aMember | Kumpecloud Auth |
|---------|-----------------|
| Products | User roles named `aMember: {product_id}` with description set to the product title |
| Users (email/login + bcrypt password hash) | Users matched by email or username (`login`), with `customData.amember.userId` stored for linkage |
| Active access records | Role assignments on the matching user |

Only roles whose names start with `aMember:` are created, updated, or deleted by this plugin. All other roles and assignments are left untouched.

Inactive, locked, deleted, or removed aMember users have all `aMember:` role assignments revoked. When they become active again, roles are restored from current aMember access on the next sync.

User passkeys, social identities, MFA/`logtoConfig`, and other profile fields are never modified by sync.

## Configuration

### Console UI

Open **Settings → aMember sync** in the Admin Console to configure connection credentials, enable automatic sync, and trigger a manual run.

### Environment variables (optional fallback)

```bash
AMEMBER_SYNC_ENABLED=true
AMEMBER_SYNC_TENANT_ID=default
AMEMBER_SYNC_INTERVAL_SECONDS=3600
AMEMBER_SYNC_SKIP_PASSWORDS=true        # optional

# API mode
AMEMBER_SYNC_MODE=api
AMEMBER_API_URL=https://billing.example.com/amember/api
AMEMBER_API_KEY=your-rest-api-key

# MariaDB / MySQL mode
AMEMBER_SYNC_MODE=database
AMEMBER_DATABASE_URL=mysql://user:pass@host:3306/amember
AMEMBER_TABLE_PREFIX=am_
```

Console-stored configuration takes precedence over environment variables when enabled.

## Running sync

**Automatic (core):** When enabled in Console (or via `AMEMBER_SYNC_ENABLED=true`), core runs sync on startup and on the configured interval.

**Manual (CLI):**

```bash
pnpm cli amember sync
pnpm cli amember sync --tenant default
```

**Manual (API):** `POST /api/configs/amember-sync/run`

## Password notes

aMember stores bcrypt hashes in `am_user.pass`. The plugin imports those hashes directly (`passwordEncryptionMethod: Bcrypt`) only when the hash changes, so users who set up passkeys or change passwords in Logto are not overwritten on every sync. PHP `$2y$` hashes are normalized to `$2a$` for Node compatibility.
