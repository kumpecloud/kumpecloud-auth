import { DatabaseDialect, getDatabaseDialectFromUrl } from '@logto/database';

export type ResolveMigrateUrlsInput = {
  from?: string;
  to?: string;
};

export type ResolvedMigrateUrls = {
  fromUrl: string;
  toUrl: string;
};

/**
 * Build a Postgres URL from compose-style env vars when MIGRATE_FROM_URL is unset.
 * Defaults match the in-compose `postgres` service hostname.
 */
export const buildPostgresUrlFromEnv = (
  env: NodeJS.ProcessEnv = process.env
): string | undefined => {
  const password = env.POSTGRES_PASSWORD;

  if (password === undefined || password === '') {
    return;
  }

  const user = env.POSTGRES_USER || 'postgres';
  const host = env.POSTGRES_HOST || 'postgres';
  const port = env.POSTGRES_PORT || '5432';
  const database = env.POSTGRES_DB || 'logto';

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
};

/**
 * Resolve pg→MariaDB migration URLs.
 *
 * Target (MariaDB), in order:
 *   --to → MIGRATE_TO_URL → DB_URL
 *
 * Source (Postgres), in order:
 *   --from → MIGRATE_FROM_URL → POSTGRES_URL → POSTGRES_* constructed URL
 */
export const resolveMigrateUrls = (
  input: ResolveMigrateUrlsInput = {},
  env: NodeJS.ProcessEnv = process.env
): ResolvedMigrateUrls => {
  const toUrl = input.to || env.MIGRATE_TO_URL || env.DB_URL || '';
  const fromUrl =
    input.from || env.MIGRATE_FROM_URL || env.POSTGRES_URL || buildPostgresUrlFromEnv(env) || '';

  if (!fromUrl) {
    throw new Error(
      'Missing Postgres source URL. Pass --from, or set MIGRATE_FROM_URL / POSTGRES_URL, ' +
        'or POSTGRES_PASSWORD (with optional POSTGRES_USER/HOST/PORT/DB).'
    );
  }

  if (!toUrl) {
    throw new Error(
      'Missing MariaDB target URL. Pass --to, or set MIGRATE_TO_URL / DB_URL (mariadb://…).'
    );
  }

  const fromDialect = getDatabaseDialectFromUrl(fromUrl);
  const toDialect = getDatabaseDialectFromUrl(toUrl);

  if (fromDialect !== DatabaseDialect.Postgres) {
    throw new Error(`Migration --from must be a postgres:// URL (got dialect ${fromDialect})`);
  }

  if (toDialect !== DatabaseDialect.MariaDB) {
    throw new Error(`Migration --to must be a mariadb:// or mysql:// URL (got dialect ${toDialect})`);
  }

  return { fromUrl, toUrl };
};
