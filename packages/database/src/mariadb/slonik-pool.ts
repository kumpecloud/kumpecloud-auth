import { sql, type DatabasePool, type QueryResult } from '@silverhand/slonik';
import mysql from 'mysql2/promise';

import { parseDatabaseUrl } from '../dialect.js';
import { normalizeJsonValue } from '../json-normalize.js';
import type { PoolFactoryOptions } from '../types.js';

export type MariaDatabasePool = DatabasePool & { readonly dialect: 'mariadb' };

type SlonikQueryToken = {
  sql: string;
  type: 'SLONIK_TOKEN_SQL';
  values: readonly unknown[];
};

type QueryInput = SlonikQueryToken | string;

/** Match Slonik `createInterceptorsPreset` row key formatting (snake_case → camelCase). */
export const camelCaseColumnName = (name: string): string =>
  name.replaceAll(/_([a-z0-9])/gi, (_, char: string) => String(char).toUpperCase());

const booleanishExactNames = new Set([
  'enabled',
  'consumed',
  'required',
  'active',
  'syncProfile',
  'enableTokenStorage',
  'hideLogtoBranding',
  'autoSendAuthorizationRequest',
  'consentRequired',
  'rotateRefreshToken',
]);

/** MariaDB TINYINT(1) comes back as 0/1; coerce common boolean column names to real booleans. */
export const isBooleanishColumnName = (camelKey: string): boolean =>
  booleanishExactNames.has(camelKey) ||
  /^(is|has|was|can|should)[A-Z]/.test(camelKey) ||
  camelKey.endsWith('Enabled') ||
  camelKey.endsWith('Disabled');

export const coerceBooleanishValue = (camelKey: string, value: unknown): unknown => {
  if ((value === 0 || value === 1) && isBooleanishColumnName(camelKey)) {
    return value === 1;
  }

  return value;
};

/** Schema maps timestamptz → number (ms); mysql2 returns Date. */
export const isTimestampishColumnName = (camelKey: string): boolean =>
  camelKey === 'date' || camelKey.endsWith('At');

export const coerceTimestampishValue = (camelKey: string, value: unknown): unknown => {
  if (value instanceof Date && isTimestampishColumnName(camelKey)) {
    return value.getTime();
  }

  return value;
};
const isQueryToken = (value: unknown): value is SlonikQueryToken =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  (value as SlonikQueryToken).type === 'SLONIK_TOKEN_SQL';

const convertPostgresPlaceholders = (queryText: string) => queryText.replace(/\$(\d+)/g, '?');

/** Convert Postgres "identifiers" to MariaDB `identifiers`, ignoring string literals. */
export const rewriteDoubleQuotedIdentifiers = (queryText: string): string => {
  let result = '';
  let inSingleQuote = false;

  for (let index = 0; index < queryText.length; index += 1) {
    const char = queryText[index]!;
    const next = queryText[index + 1];

    if (inSingleQuote) {
      result += char;

      if (char === "'" && next === "'") {
        result += next;
        index += 1;
        continue;
      }

      if (char === "'") {
        inSingleQuote = false;
      }

      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      result += char;
      continue;
    }

    if (char === '"') {
      let end = index + 1;
      let identifier = '';

      while (end < queryText.length) {
        const current = queryText[end]!;
        const following = queryText[end + 1];

        if (current === '"' && following === '"') {
          identifier += '"';
          end += 2;
          continue;
        }

        if (current === '"') {
          break;
        }

        identifier += current;
        end += 1;
      }

      result += `\`${identifier.replaceAll('`', '``')}\``;
      index = end;
      continue;
    }

    result += char;
  }

  return result;
};

/** Best-effort SQL rewrites for Slonik queries not yet ported to QueryDialect. */
export const rewritePostgresSqlForMariaDB = (queryText: string): string =>
  rewriteDoubleQuotedIdentifiers(
    queryText
      .replaceAll("'{}'::jsonb", 'JSON_OBJECT()')
      .replaceAll("'[]'::jsonb", 'JSON_ARRAY()')
      .replaceAll('array[]::varchar[]', 'JSON_ARRAY()')
      .replaceAll('::jsonb', '')
      .replaceAll('::varchar[]', '')
      .replaceAll('::double precision', '')
      .replaceAll('::int', '')
      .replace(/\bjson_build_object\b/gi, 'JSON_OBJECT')
      .replace(/\bjsonb_array_length\s*\(/gi, 'JSON_LENGTH(')
      .replace(/\bjson_array_length\s*\(/gi, 'JSON_LENGTH(')
      .replace(/\bon conflict do nothing\b/gi, 'ON DUPLICATE KEY UPDATE tenant_id = tenant_id')
      .replace(
        /\bon conflict\s*\([^)]*\)\s*do update set\s+([\s\S]*?)(?=$|;)/gi,
        (_match, assignments: string) => {
          const rewritten = String(assignments)
            .replace(/\bexcluded\.(`?[a-zA-Z_][\w]*`?)/gi, 'VALUES($1)')
            .trim()
            .replace(/;?\s*$/, '');

          return `ON DUPLICATE KEY UPDATE ${rewritten}`;
        }
      )
      .replace(
        /\bcoalesce\(([^,]+),\s*'\{\}'::jsonb\)\s*\|\|/gi,
        'JSON_MERGE_PATCH(COALESCE($1, JSON_OBJECT()),'
      )
      // Prefer millis form first, then any remaining to_timestamp(...)
      .replace(/\bto_timestamp\(([^)]+)\s*\/\s*1000\)/gi, (_match, expr: string) => {
        return `FROM_UNIXTIME(${expr.trim()} / 1000)`;
      })
      .replace(/\bto_timestamp\(([^)]+)\)/gi, (_match, expr: string) => {
        return `FROM_UNIXTIME(${expr.trim()})`;
      })
      // Postgres regex: ~ (case-sensitive) / ~* (case-insensitive)
      .replace(/\s+~\*\s+/g, ' REGEXP ')
      .replace(/\s+~\s+/g, ' REGEXP BINARY ')
      // jsonb key existence: column ? 'key'
      .replace(
        /((?:`[^`]+`|"[^"]+"|[a-zA-Z_][\w.]*)\s*)\?\s*'((?:\\'|[^'])*)'/g,
        (_match, column: string, key: string) =>
          `JSON_CONTAINS_PATH(${column.trim()}, 'one', '$.${key}')`
      )
      // jsonb text extract: column->>'key'
      .replace(
        /((?:`[^`]+`|"[^"]+"|[a-zA-Z_][\w.]*)\s*)->>\s*'((?:\\'|[^'])*)'/g,
        (_match, column: string, key: string) =>
          `JSON_UNQUOTE(JSON_EXTRACT(${column.trim()}, '$.${key}'))`
      )
  );

const serializeValue = (value: unknown) => {
  if (
    value !== null &&
    typeof value === 'object' &&
    !Buffer.isBuffer(value) &&
    !(value instanceof Date)
  ) {
    return JSON.stringify(value);
  }

  return value;
};

const toQueryResult = <R extends Record<string, unknown>>(
  rows: R[],
  rowCount = rows.length
): QueryResult<R> =>
  ({
    rows,
    rowCount,
    command: 'SELECT',
    fields: [],
    notices: [],
  }) as QueryResult<R>;

const normalizeMariaRows = <R extends Record<string, unknown>>(rows: R[]): R[] =>
  rows.map(
    (row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => {
          const camelKey = camelCaseColumnName(key);
          const normalized = coerceTimestampishValue(
            camelKey,
            coerceBooleanishValue(camelKey, normalizeJsonValue(value))
          );

          return [camelKey, normalized];
        })
      ) as R
  );

const executeOnConnection = async <R extends Record<string, unknown>>(
  connection: mysql.PoolConnection,
  sqlOrToken: QueryInput,
  values?: readonly unknown[]
): Promise<QueryResult<R>> => {
  if (typeof sqlOrToken === 'string') {
    const rewritten = rewritePostgresSqlForMariaDB(sqlOrToken);
    const [result] = await connection.query(rewritten, values as unknown[]);

    if (Array.isArray(result)) {
      // MariaDB returns snake_case keys + JSON-as-string; normalize to Slonik/Postgres shape.
      return toQueryResult(normalizeMariaRows(result as R[]));
    }

    const header = result as mysql.ResultSetHeader;

    return toQueryResult([], header.affectedRows);
  }

  const { sql: queryText, values: tokenValues } = sqlOrToken;
  const mariaSql = rewritePostgresSqlForMariaDB(convertPostgresPlaceholders(queryText));
  const serialized = tokenValues.map(serializeValue);
  const [result] = await connection.query(mariaSql, serialized);

  if (Array.isArray(result)) {
    return toQueryResult(normalizeMariaRows(result as R[]));
  }

  const header = result as mysql.ResultSetHeader;

  return toQueryResult([], header.affectedRows);
};

const createConnectionMethods = (connection: mysql.PoolConnection) => {
  const run = async <R extends Record<string, unknown>>(
    sqlOrToken: QueryInput,
    values?: readonly unknown[]
  ) => executeOnConnection<R>(connection, sqlOrToken, values);

  return {
    query: run,
    any: async <R extends Record<string, unknown>>(sqlOrToken: QueryInput, values?: readonly unknown[]) => {
      const { rows } = await run<R>(sqlOrToken, values);

      return rows;
    },
    exists: async (sqlOrToken: QueryInput, values?: readonly unknown[]) => {
      const { rows } = await run(sqlOrToken, values);

      return rows.length > 0;
    },
    oneFirst: async <T>(sqlOrToken: QueryInput, values?: readonly unknown[]) => {
      const { rows } = await run<Record<string, T>>(sqlOrToken, values);

      if (rows.length === 0) {
        throw new Error('Expected one row, got none');
      }

      const [firstValue] = Object.values(rows[0]!);

      return firstValue!;
    },
    one: async <R extends Record<string, unknown>>(sqlOrToken: QueryInput, values?: readonly unknown[]) => {
      const { rows } = await run<R>(sqlOrToken, values);

      if (rows.length === 0) {
        throw new Error('Expected one row, got none');
      }

      if (rows.length > 1) {
        throw new Error('Expected one row, got multiple');
      }

      return rows[0]!;
    },
    maybeOne: async <R extends Record<string, unknown>>(
      sqlOrToken: QueryInput,
      values?: readonly unknown[]
    ) => {
      const { rows } = await run<R>(sqlOrToken, values);

      return rows[0] ?? null;
    },
  };
};

export const createMariaPool = async (
  databaseUrl: string,
  options: PoolFactoryOptions = {}
): Promise<MariaDatabasePool> => {
  const parsed = parseDatabaseUrl(databaseUrl);
  const pool = mysql.createPool({
    host: parsed.hostname,
    port: parsed.port,
    user: parsed.username,
    password: parsed.password,
    database: parsed.database,
    connectionLimit: options.maximumPoolSize ?? 10,
    connectTimeout: options.connectionTimeout,
    multipleStatements: true,
  });

  const withConnection = async <T>(
    handler: (methods: ReturnType<typeof createConnectionMethods>) => Promise<T>
  ) => {
    const connection = await pool.getConnection();

    try {
      return await handler(createConnectionMethods(connection));
    } finally {
      connection.release();
    }
  };

  const basePool = {
    dialect: 'mariadb' as const,
    query: async <R extends Record<string, unknown>>(sqlOrToken: QueryInput, values?: readonly unknown[]) => {
      if (typeof sqlOrToken === 'string' || (isQueryToken(sqlOrToken) && values !== undefined)) {
        return withConnection((methods) => methods.query<R>(sqlOrToken, values));
      }

      return withConnection((methods) => methods.query<R>(sqlOrToken));
    },
    any: async <R extends Record<string, unknown>>(sqlOrToken: QueryInput, values?: readonly unknown[]) =>
      withConnection((methods) => methods.any<R>(sqlOrToken, values)),
    exists: async (sqlOrToken: QueryInput, values?: readonly unknown[]) =>
      withConnection((methods) => methods.exists(sqlOrToken, values)),
    oneFirst: async <T>(sqlOrToken: QueryInput, values?: readonly unknown[]) =>
      withConnection((methods) => methods.oneFirst<T>(sqlOrToken, values)),
    one: async <R extends Record<string, unknown>>(sqlOrToken: QueryInput, values?: readonly unknown[]) =>
      withConnection((methods) => methods.one<R>(sqlOrToken, values)),
    maybeOne: async <R extends Record<string, unknown>>(
      sqlOrToken: QueryInput,
      values?: readonly unknown[]
    ) => withConnection((methods) => methods.maybeOne<R>(sqlOrToken, values)),
    transaction: async <T>(handler: (connection: DatabasePool) => Promise<T>) => {
      const connection = await pool.getConnection();
      const methods = createConnectionMethods(connection);

      try {
        await connection.beginTransaction();
        const result = await handler(methods as unknown as DatabasePool);
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
    connect: async <T>(handler: (connection: DatabasePool) => Promise<T>) =>
      withConnection(async (methods) => handler(methods as unknown as DatabasePool)),
    end: async () => {
      await pool.end();
    },
  };

  return basePool as unknown as MariaDatabasePool;
};

export const verifyMariaPool = async (pool: MariaDatabasePool) => {
  await pool.query(sql`select 1`);
  return pool;
};
