# @logto/plugin-amember-sync

Bidirectional sync between aMember and Kumpecloud Auth (Logto fork).

## Recommended setup (hybrid)

| Direction | Connection | Why |
|-----------|------------|-----|
| **Inbound** (aMember → Auth) | **MySQL / MariaDB** | Efficient bulk reads for products, users, access, and password hashes |
| **Outbound** (Auth → aMember) | **REST API** | Safe writes with aMember business logic for signups, profiles, passwords, and access grants |

Configure both database credentials and API credentials in Console. Inbound mode defaults to `database`; outbound always uses the API.

## What it syncs

### Inbound (aMember → Auth)

| aMember | Kumpecloud Auth |
|---------|-----------------|
| Products | User roles named `{product_id}: {title}` with description set to the product title |
| Users (email/login + password hash) | Users matched by `customData.amember.userId`, email, or username (`login`) |
| Active access records | Role assignments on the matching user |

Only roles whose names match `{product_id}: {title}` (or legacy `aMember: {product_id}`) are managed by product/access sync.

### Outbound (Auth → aMember)

When **outbound sync** is enabled:

| Auth event | aMember action |
|------------|----------------|
| User signup | `POST /users` with login, email, profile, plaintext password when available |
| Profile / custom data update | `PUT /users/{id}` |
| Password change | `PUT /users/{id}` with `pass` |
| Manual role grant (two-way role sync only) | `POST /access` with lifetime expiry (`2037-12-31`) |
| Manual role revocation (two-way role sync only) | Expire matching access record |

### Product role sync direction

| Mode | Inbound (aMember → Auth) | Outbound roles (Auth → aMember) |
|------|--------------------------|----------------------------------|
| **One-way** (default) | aMember access drives Logto product roles | Logto role changes are **not** pushed to aMember |
| **Two-way** | Same as one-way | Manual Logto role grants/revocations update aMember access |

## Configuration

### Console UI

Open **Settings → aMember sync**:

1. **General** — enable inbound sync, interval, password hash import, product role sync direction
2. **Inbound** — choose MySQL (recommended) or API; provide database host, port, username, password, and database name when using MySQL
3. **Outbound** — enable push to aMember; provide API URL and key (also used for inbound when inbound mode is API)

### Environment variables (optional fallback)

```bash
AMEMBER_SYNC_ENABLED=true
AMEMBER_SYNC_OUTBOUND_DISABLED=true   # optional; outbound on by default
AMEMBER_SYNC_ROLE_SYNC_MODE=one_way   # or two_way
AMEMBER_SYNC_TENANT_ID=default
AMEMBER_SYNC_INTERVAL_SECONDS=3600
AMEMBER_SYNC_SKIP_PASSWORDS=true        # optional

# Inbound (default: database)
AMEMBER_SYNC_INBOUND_MODE=database      # or AMEMBER_SYNC_MODE=database
AMEMBER_DATABASE_HOST=db.example.com
AMEMBER_DATABASE_PORT=3306
AMEMBER_DATABASE_USER=amember
AMEMBER_DATABASE_PASSWORD=secret
AMEMBER_DATABASE_NAME=amember
# AMEMBER_DATABASE_URL=mysql://user:pass@host:3306/amember   # legacy alternative
AMEMBER_TABLE_PREFIX=am_

# Outbound (and inbound when inbound mode is api)
AMEMBER_API_URL=https://billing.example.com/amember/api
AMEMBER_API_KEY=your-rest-api-key
```

Console-stored configuration takes precedence over environment variables when enabled.

**Outbound** (Auth → aMember) only requires the outbound toggle plus API URL and key. Inbound sync does not need to be enabled, and MySQL credentials are not required for outbound-only setups.

**Inbound** scheduled sync requires the main sync toggle and valid inbound credentials (MySQL or API, depending on mode).

## Running inbound sync

**Automatic (core):** When enabled, core runs inbound sync on startup and on the configured interval. Outbound sync runs inline on user lifecycle events.

**Manual (CLI):**

```bash
pnpm cli amember sync
pnpm cli amember sync --tenant default
```

**Manual (API):** `POST /api/configs/amember-sync/run`

## aMember API permissions (outbound)

Enable the API module and grant your key: `users` (read/write), `access` (read/write).
