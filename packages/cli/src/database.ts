import type { SchemaLike } from '@logto/schemas';
import { parseTimeoutEnv } from '@logto/shared';
import {
  createDatabasePool,
  createPostgresPool,
  DatabaseDialect,
  parseDatabaseUrl,
  parseDsn,
  stringifyDsn,
} from '@logto/database';
import type { DatabasePool as SlonikDatabasePool } from '@silverhand/slonik';
import { assert, conditional } from '@silverhand/essentials';
import { sql } from '@silverhand/slonik';
import decamelize from 'decamelize';
import { DatabaseError } from 'pg-protocol';

import { convertToPrimitiveOrSql } from './sql.js';
import { ConfigKey, consoleLog, getCliConfigWithPrompt } from './utils.js';

const databaseStatementTimeout = parseTimeoutEnv(process.env.DATABASE_STATEMENT_TIMEOUT);

export const defaultDatabaseUrl = 'mariadb://logto:p0stgr3s@localhost:3306/logto';

export const getDatabaseUrlFromConfig = async () =>
  (await getCliConfigWithPrompt({
    key: ConfigKey.DatabaseUrl,
    readableKey: 'Logto database URL',
    defaultValue: defaultDatabaseUrl,
  })) ?? '';

const getPoolOptions = () => ({
  ...conditional(
    databaseStatementTimeout !== undefined && { statementTimeout: databaseStatementTimeout }
  ),
});

export const getDatabaseDialect = (databaseUrl?: string) =>
  parseDatabaseUrl(databaseUrl ?? process.env.DB_URL ?? defaultDatabaseUrl).dialect;

export const createPoolFromConfig = async (databaseUrl?: string): Promise<SlonikDatabasePool> => {
  const resolvedUrl = databaseUrl ?? (await getDatabaseUrlFromConfig());
  assert(parseDatabaseUrl(resolvedUrl).database, new Error('Database name is required in URL'));

  const pool = await createDatabasePool(resolvedUrl, getPoolOptions());

  return pool as SlonikDatabasePool;
};

const createMariaDatabaseIfNeeded = async (databaseUrl: string) => {
  const parsed = parseDatabaseUrl(databaseUrl);
  const maintenanceUrl = databaseUrl.replace(`/${parsed.database}`, '/mysql');
  const maintenancePool = await createDatabasePool(maintenanceUrl, getPoolOptions());

  if ('dialect' in maintenancePool && maintenancePool.dialect === 'mariadb') {
    await (maintenancePool as import('@logto/database').MariaDatabasePool).query(
      `CREATE DATABASE IF NOT EXISTS \`${parsed.database.replaceAll('`', '``')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await maintenancePool.end();
    consoleLog.succeed(`Created database ${parsed.database}`);
    return;
  }

  await maintenancePool.end();
};

/**
 * Create a database pool with the URL in CLI config; if no URL found, prompt to input.
 * If the given database does not exist, create it (Postgres or MariaDB).
 */
export const createPoolAndDatabaseIfNeeded = async () => {
  const databaseUrl = await getDatabaseUrlFromConfig();

  try {
    return await createPoolFromConfig(databaseUrl);
  } catch (error: unknown) {
    const { dialect } = parseDatabaseUrl(databaseUrl);

    if (dialect === DatabaseDialect.MariaDB) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error.code === 'ER_BAD_DB_ERROR' || error.code === 'ER_ACCESS_DENIED_ERROR')
      ) {
        await createMariaDatabaseIfNeeded(databaseUrl);
        return createPoolFromConfig(databaseUrl);
      }

      consoleLog.fatal(error);
    }

    // https://www.postgresql.org/docs/14/errcodes-appendix.html
    if (!(error instanceof DatabaseError && error.code === '3D000')) {
      consoleLog.fatal(error);
    }

    const dsn = parseDsn(databaseUrl);
    const databaseName = dsn.databaseName ?? '?';
    const maintenancePool = await createPostgresPool(
      stringifyDsn({ ...dsn, databaseName: 'postgres' }),
      getPoolOptions()
    );
    await maintenancePool.query(sql`
      create database ${sql.identifier([databaseName])}
        with
        encoding = 'UTF8'
        connection_limit = -1;
    `);
    await maintenancePool.end();

    consoleLog.succeed(`Created database ${databaseName}`);

    return createPoolFromConfig(databaseUrl);
  }
};

/**
 * Build an `insert into` query from the given payload. If the payload is an array, it will insert
 * multiple rows.
 */
export const insertInto = <T extends SchemaLike<string>>(payload: T | T[], table: string) => {
  const first = Array.isArray(payload) ? payload[0] : payload;

  if (!first) {
    throw new Error('Payload cannot be empty');
  }

  const keys = Object.keys(first);
  const values = Array.isArray(payload) ? payload : [payload];

  return sql`
    insert into ${sql.identifier([table])}
    (${sql.join(
      keys.map((key) => sql.identifier([decamelize(key)])),
      sql`, `
    )})
    values ${sql.join(
      values.map(
        (object) =>
          sql`(${sql.join(
            keys.map((key) => convertToPrimitiveOrSql(key, object[key] ?? null)),
            sql`, `
          )})`
      ),
      sql`, `
    )}
  `;
};
