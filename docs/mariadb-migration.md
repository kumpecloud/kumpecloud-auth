# MariaDB Migration (Issue #99)

KumpeCloud Auth is migrating from PostgreSQL to MariaDB with **dual-dialect support** during transition. `DB_URL` selects the dialect:

| URL prefix | Dialect |
|---|---|
| `postgres://`, `postgresql://` | PostgreSQL (existing path) |
| `mariadb://`, `mysql://` | MariaDB (new path) |

Target: **MariaDB 10.11+** or **11.x**, driver **mysql2**.

## Architecture

- **`@logto/database`** — dialect detection, pool adapters, `QueryDialect`, `TenantGuard`
- **`packages/schemas/tables-mariadb/`** — baseline MariaDB DDL (current head snapshot)
- **`packages/schemas/alterations-mariadb/`** — forward-only MariaDB migrations (not porting 247 Postgres alterations)
- **CLI** — `db seed`, `db alteration deploy`, `db migrate` with `--dialect` / URL-based routing

## Tenancy

| Concern | PostgreSQL (interim) | MariaDB |
|---|---|---|
| Isolation | Per-tenant DB roles + RLS (`current_user`) | Single app user + `TenantGuard` + session `@logto_tenant_id` |
| `set_tenant_id` trigger | `_functions.sql` + `_after_each.sql` | `_functions_mariadb.sql` + session variable fallback |
| Admin tenant | Role grants + RLS policies | Explicit `tenant_id` in `TenantContext`; admin bypass where RLS allows |

Postgres RLS policy semantics (from `_after_each.sql`):

```sql
using (tenant_id = (select id from tenants where db_user = current_user));
```

MariaDB `TenantGuard` enforces equivalent filtering on tenant-scoped tables.

## Postgres feature inventory

| Feature | Approx. files | Primary locations | MariaDB approach |
|---|---|---|---|
| Row Level Security | ~70 tables | `tables/_after_each.sql`, `tables/_after_all.sql` | `TenantGuard` + triggers without RLS |
| Per-tenant roles | 3+ | `seed/tenant.ts`, `tables/_before_all.sql` | Skip on MariaDB; metadata-only `db_user` columns |
| `jsonb` + `\|\|` merge | 29+ tables, `update-where.ts` | `packages/core/src/database/update-where.ts` | `JSON` + `JSON_MERGE_PATCH` |
| `ON CONFLICT` | 5+ | `insert-into.ts`, `cli/queries/system.ts` | `ON DUPLICATE KEY UPDATE` |
| `RETURNING` | 10+ | `insert-into.ts`, `update-where.ts` | Follow-up `SELECT` |
| Postgres ENUMs | 5+ | `users.sql`, etc. | `VARCHAR` + `CHECK` |
| GIN `jsonb_path_ops` | 2+ | `users.sql` | B-tree / functional index (evaluate per query) |
| `SIMILAR TO` / `~~*` | 1 | `packages/core/src/utils/search.ts` | `REGEXP` / `LOWER(x) LIKE` |
| `sql.array` + `ANY()` | 3+ | `search.ts`, `RelationQueries.ts` | `IN (...)` |
| `to_regclass` | 2 | `cli/queries/system.ts` | `information_schema.tables` |
| `plpgsql` triggers | 2 | `tables/_functions.sql` | MariaDB `BEFORE INSERT/UPDATE` triggers |
| `pg-protocol` error codes | 10+ | CLI, middleware | `mysql2` `errno` / `sqlState` mapping |
| 247 alterations | 247 | `packages/schemas/alterations/` | Baseline + `alterations-mariadb/` only |

## CLI commands

```bash
# Seed (dialect from DB_URL or --dialect mariadb)
pnpm cli db seed

# Deploy MariaDB alterations
pnpm cli db alteration deploy latest --dialect mariadb

# Migrate data Postgres → MariaDB
pnpm cli db migrate --from "$PG_URL" --to "$MARIADB_URL" --dry-run
pnpm cli db migrate --from "$PG_URL" --to "$MARIADB_URL" --batch-size 500
```

MariaDB alteration state is stored in `systems` under key `mariadbAlterationState` (separate from Postgres `alterationState`).

## Cutover runbook (staging → production)

### Prerequisites

1. MariaDB 11 deployed alongside Postgres (see `docker-compose.mariadb.yml` and `.kumpeapps-deploy-bot/*/docker-compose.yml`)
2. Auth image with dual-dialect support (branch `feature/#99` or later)
3. Postgres backup verified

### Staging

1. Deploy MariaDB service with healthcheck
2. `export DB_URL=mariadb://logto:password@mariadb:3306/logto`
3. `pnpm cli db seed` on empty MariaDB
4. `pnpm cli db alteration deploy latest --dialect mariadb`
5. `pnpm cli db migrate --from "$STAGE_PG_URL" --to "$STAGE_MARIADB_URL" --dry-run`
6. Run migrate without `--dry-run`; verify row counts and checksums in CLI output
7. Point staging `DB_URL` to MariaDB; smoke test OIDC, Console, Experience, aMember sync
8. Run integration tests: `DB_URL=mariadb://... pnpm test:integration`

### Production (maintenance window)

1. Enable maintenance mode
2. `pnpm cli db migrate --from "$PROD_PG_URL" --to "$PROD_MARIADB_URL" --dry-run` — review plan
3. Run migration; retain CLI verification output
4. Switch `DB_URL` to MariaDB in deploy compose / env
5. Restart auth services; verify:
   - OIDC discovery + token endpoint
   - Admin Console login
   - Experience sign-in
   - aMember product sync (reads separate MySQL — unchanged)
6. Keep Postgres read-only for N days (recommended: 14–30)

### Rollback

1. Revert `DB_URL` to Postgres URL
2. Restart services (Postgres still has pre-cutover data if migrate was not destructive)
3. If Postgres was modified post-migrate, restore from backup

### Post-cutover (Phase 9 — not in this branch)

After 30+ days stable on MariaDB: remove Slonik, Postgres alterations archive, CI postgres matrix. See migration plan Phase 9.

## Local development (MariaDB)

```bash
docker compose -f docker-compose.mariadb.yml up -d
export DB_URL=mariadb://logto:p0stgr3s@localhost:3306/logto
pnpm cli db seed
pnpm cli db alteration deploy latest --dialect mariadb
pnpm start:dev
```

## Risk register

| Risk | Mitigation |
|---|---|
| Tenant leak without RLS | `TenantGuard` + cross-tenant integration tests |
| JSON query performance | Benchmark; add indexes where GIN existed |
| Data loss on migrate | Dry-run, checksums, Postgres backup retention |
| aMember confusion | Auth DB MariaDB ≠ aMember MySQL reads (documented in kumpeapps-auth skill) |
