# @logto/plugin-amember-sync

Sync aMember products, users, and access records into Kumpecloud Auth (Logto fork).

## What it syncs

| aMember | Kumpecloud Auth |
|---------|-----------------|
| Products | User roles named `aMember: {product_id}` with description set to the product title |
| Users (email/login + bcrypt password hash) | Users matched by email or username (`login`), with profile fields stored under `customData.amember` |
| `mobile_area_code` + `mobile_number` | `primaryPhone` (normalized international format) |
| Profile columns (see below) | `customData.amember.*` (aMember column names preserved) |

Profile columns synced into `customData.amember`: `birthday`, `pushover_key`, `subusers_parent_id`, `pin`, `comment`, `i_agree`, `is_approved`, `is_locked`, `unsubscribed`, `status`, `name_f`, `name_l`, `street`, `street2`, `city`, `state`, `zip`, `country`, `lang`, plus `userId` for linkage.
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

aMember stores password hashes, not plaintext. Supported import formats:

| aMember field | Format | Example prefix |
|---------------|--------|----------------|
| `crypt_pass` (database sync) | Unix MD5 crypt | `$1$` |
| `pass` (API sync fallback) | phpass portable hash | `$P$` / `$H$` |
| `pass` (API sync fallback) | bcrypt | `$2y$` / `$2a$` |
| `pass` (API sync fallback) | raw MD5 hex | 32 hex chars |

Database mode reads `am_user.crypt_pass` only. API mode may still supply legacy `pass` values when `crypt_pass` is unavailable. Hashes are imported only when they change, so users who set up passkeys or change passwords in Logto are not overwritten on every sync. PHP `$2y$` bcrypt hashes are normalized to `$2a$` for Node compatibility.
