import { DatabaseDialect, getDatabaseDialectFromUrl } from '@logto/database';
import type { AlterationState, System, SystemKey } from '@logto/schemas';
import { systemGuards, Systems, AlterationStateKey } from '@logto/schemas';
import type { Nullable } from '@silverhand/essentials';
import type { CommonQueryMethods, DatabaseTransactionConnection } from '@silverhand/slonik';
import { sql } from '@silverhand/slonik';
import { DatabaseError } from 'pg-protocol';
import type { z } from 'zod';

import { convertToIdentifiers } from '../sql.js';

const { fields, table } = convertToIdentifiers(Systems);

const getDialectFromEnv = () =>
  process.env.DB_URL
    ? getDatabaseDialectFromUrl(process.env.DB_URL)
    : DatabaseDialect.Postgres;

export const doesTableExist = async (pool: CommonQueryMethods, tableName: string) => {
  const dialect = getDialectFromEnv();

  if (dialect === DatabaseDialect.MariaDB) {
    const { rows } = await pool.query<{ count: number }>(sql`
      select count(*) as count
      from information_schema.tables
      where table_schema = database()
      and table_name = ${tableName}
    `);

    return Number(rows[0]?.count ?? 0) > 0;
  }

  const { rows } = await pool.query<{ regclass: Nullable<string> }>(
    sql`select to_regclass(${tableName}) as regclass`
  );

  return Boolean(rows[0]?.regclass);
};

export const doesSystemsTableExist = async (pool: CommonQueryMethods) =>
  doesTableExist(pool, Systems.table);

const legacyLogtoConfigsTable = '_logto_configs';

const getAlterationStateTable = async (pool: CommonQueryMethods) =>
  (await doesSystemsTableExist(pool))
    ? sql.identifier([Systems.table])
    : sql.identifier([legacyLogtoConfigsTable]); // Fall back to the old config table

const getAlterationStateKey = (dialect: DatabaseDialect = getDialectFromEnv()) =>
  dialect === DatabaseDialect.MariaDB
    ? AlterationStateKey.MariaDBAlterationState
    : AlterationStateKey.AlterationState;

export const getCurrentDatabaseAlterationTimestamp = async (
  pool: CommonQueryMethods,
  dialect?: DatabaseDialect
) => {
  const table = await getAlterationStateTable(pool);
  const stateKey = getAlterationStateKey(dialect);

  try {
    const result = await pool.maybeOne<System>(
      sql`select * from ${table} where ${fields.key}=${stateKey}`
    );
    const parsed = systemGuards[stateKey].safeParse(result?.value);

    return (parsed.success && parsed.data.timestamp) || 0;
  } catch (error: unknown) {
    // Relation does not exist, treat as 0
    if (error instanceof DatabaseError && error.code === '42P01') {
      return 0;
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_DB_ERROR')
    ) {
      return 0;
    }

    throw error;
  }
};

export const updateDatabaseTimestamp = async (
  connection: DatabaseTransactionConnection,
  timestamp: number,
  dialect?: DatabaseDialect
) => {
  const table = await getAlterationStateTable(connection);
  const stateKey = getAlterationStateKey(dialect);
  const value: AlterationState = {
    timestamp,
    updatedAt: new Date().toISOString(),
  };

  const resolvedDialect = dialect ?? getDialectFromEnv();

  if (resolvedDialect === DatabaseDialect.MariaDB) {
    const serialized = JSON.stringify(value);

    await connection.query(sql`
      insert into ${table} (${fields.key}, ${fields.value})
        values (${stateKey}, ${serialized})
        on duplicate key update ${fields.value} = ${serialized}
    `);

    return;
  }

  await connection.query(
    sql`
      insert into ${table} (${fields.key}, ${fields.value}) 
        values (${stateKey}, ${sql.jsonb(value)})
        on conflict (${fields.key}) do update set ${fields.value}=excluded.${fields.value}
    `
  );
};

export const getRowByKey = async (pool: CommonQueryMethods, key: SystemKey) =>
  pool.maybeOne<System>(sql`
    select ${sql.join([fields.key, fields.value], sql`,`)} from ${table}
      where ${fields.key} = ${key}
  `);

export const updateValueByKey = async <T extends SystemKey>(
  pool: CommonQueryMethods,
  key: T,
  value: z.infer<(typeof systemGuards)[T]>
) => {
  const dialect = getDialectFromEnv();

  if (dialect === DatabaseDialect.MariaDB) {
    const serialized = JSON.stringify(value);

    return pool.query(sql`
      insert into ${table} (${fields.key}, ${fields.value})
        values (${key}, ${serialized})
        on duplicate key update ${fields.value} = ${serialized}
    `);
  }

  return pool.query(
    sql`
      insert into ${table} (${fields.key}, ${fields.value}) 
        values (${key}, ${sql.jsonb(value)})
        on conflict (${fields.key})
          do update set ${fields.value}=excluded.${fields.value}
    `
  );
};
