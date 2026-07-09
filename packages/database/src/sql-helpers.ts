import type { IdentifierSqlToken, SqlSqlToken, ValueExpression } from '@silverhand/slonik';
import { sql } from '@silverhand/slonik';

import { DatabaseDialect, parseDatabaseUrl } from './dialect.js';

export const getDatabaseDialectFromEnv = (): DatabaseDialect =>
  parseDatabaseUrl(process.env.DB_URL ?? '').dialect;

export const buildInArrayCondition = (
  column: IdentifierSqlToken,
  values: readonly string[],
  dialect: DatabaseDialect
): SqlSqlToken => {
  if (values.length === 0) {
    return sql`false`;
  }

  if (dialect === DatabaseDialect.MariaDB) {
    return sql`${column} in (${sql.join(values, sql`, `)})`;
  }

  return sql`${column} = any(${sql.array(values, 'varchar')})`;
};

export const buildJsonCoalesceMerge = (
  column: IdentifierSqlToken,
  value: ValueExpression,
  dialect: DatabaseDialect
): SqlSqlToken => {
  if (dialect === DatabaseDialect.MariaDB) {
    return sql`JSON_MERGE_PATCH(COALESCE(${column}, JSON_OBJECT()), ${value})`;
  }

  return sql`coalesce(${column}, '{}'::jsonb) || ${value}`;
};

export const buildJsonContains = (
  column: IdentifierSqlToken,
  value: ValueExpression,
  dialect: DatabaseDialect
): SqlSqlToken => {
  if (dialect === DatabaseDialect.MariaDB) {
    return sql`JSON_CONTAINS(${column}, ${value})`;
  }

  return sql`${column}::jsonb @> ${value}`;
};

export const buildJsonRemoveKey = (
  column: IdentifierSqlToken,
  key: string,
  dialect: DatabaseDialect
): SqlSqlToken => {
  if (dialect === DatabaseDialect.MariaDB) {
    return sql`JSON_REMOVE(${column}, ${`$.${key}`})`;
  }

  return sql`${column}::jsonb-${key}`;
};

export const buildGrantIdInAuthorizationsExists = (
  payloadColumn: IdentifierSqlToken,
  grantId: string,
  dialect: DatabaseDialect
): SqlSqlToken => {
  if (dialect === DatabaseDialect.MariaDB) {
    return sql`JSON_SEARCH(JSON_EXTRACT(${payloadColumn}, '$.authorizations'), 'one', ${grantId}, NULL, '$**.grantId') IS NOT NULL`;
  }

  return sql`exists (
    select 1
    from jsonb_each(${payloadColumn} -> 'authorizations') as authorization_entry
    where authorization_entry.value ->> 'grantId' = ${grantId}
  )`;
};

export const buildOnConflictDoNothing = (dialect: DatabaseDialect): SqlSqlToken => {
  if (dialect === DatabaseDialect.MariaDB) {
    return sql`on duplicate key update tenant_id = tenant_id`;
  }

  return sql`on conflict do nothing`;
};

export const buildEmptyStringArray = (dialect: DatabaseDialect): SqlSqlToken => {
  if (dialect === DatabaseDialect.MariaDB) {
    return sql`JSON_ARRAY()`;
  }

  return sql`array[]::varchar[]`;
};

export const buildEmptyJsonArray = (dialect: DatabaseDialect): SqlSqlToken => {
  if (dialect === DatabaseDialect.MariaDB) {
    return sql`JSON_ARRAY()`;
  }

  return sql`'[]'::jsonb`;
};

export const buildTimestampFromMillis = (
  column: IdentifierSqlToken,
  millis: number,
  dialect: DatabaseDialect
): SqlSqlToken => {
  if (dialect === DatabaseDialect.MariaDB) {
    return sql`${column} > FROM_UNIXTIME(${millis} / 1000)`;
  }

  return sql`${column} > to_timestamp(${millis}::double precision / 1000)`;
};

export const buildDateGroupExpression = (
  column: IdentifierSqlToken,
  dialect: DatabaseDialect
): SqlSqlToken => {
  if (dialect === DatabaseDialect.MariaDB) {
    return sql`date(${column})`;
  }

  return sql`date(${column})`;
};
