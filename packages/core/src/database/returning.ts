import { DatabaseDialect, getDatabaseDialectFromEnv } from '@logto/database';
import type { CommonQueryMethods, SqlSqlToken } from '@silverhand/slonik';
import { sql } from '@silverhand/slonik';

/**
 * Run an UPDATE that should return the updated row(s).
 * MariaDB has no RETURNING; execute the update then SELECT by the same predicate.
 */
export const updateThenSelect = async <T extends Record<string, unknown>>(
  pool: CommonQueryMethods,
  {
    updateSql,
    selectSql,
  }: {
    updateSql: SqlSqlToken;
    selectSql: SqlSqlToken;
  }
): Promise<T> => {
  if (getDatabaseDialectFromEnv() === DatabaseDialect.MariaDB) {
    await pool.query(updateSql);
    return pool.one<T>(selectSql);
  }

  // Caller should embed RETURNING in updateSql for Postgres.
  return pool.one<T>(updateSql);
};

export const updateThenSelectMaybe = async <T extends Record<string, unknown>>(
  pool: CommonQueryMethods,
  {
    updateSql,
    selectSql,
  }: {
    updateSql: SqlSqlToken;
    selectSql: SqlSqlToken;
  }
): Promise<T | null> => {
  if (getDatabaseDialectFromEnv() === DatabaseDialect.MariaDB) {
    await pool.query(updateSql);
    return pool.maybeOne<T>(selectSql);
  }

  return pool.maybeOne<T>(updateSql);
};

/** DELETE ... RETURNING for Postgres; DELETE then SELECT is impossible — return empty on MariaDB via pre-select. */
export const deleteReturningOne = async <T extends Record<string, unknown>>(
  pool: CommonQueryMethods,
  {
    selectBeforeDeleteSql,
    deleteSql,
  }: {
    selectBeforeDeleteSql: SqlSqlToken;
    deleteSql: SqlSqlToken;
  }
): Promise<{ row: T | undefined; rowCount: number }> => {
  if (getDatabaseDialectFromEnv() === DatabaseDialect.MariaDB) {
    const row = (await pool.maybeOne<T>(selectBeforeDeleteSql)) ?? undefined;
    const { rowCount } = await pool.query(deleteSql);
    return { row, rowCount };
  }

  const { rows, rowCount } = await pool.query<T>(deleteSql);
  return { row: rows[0], rowCount };
};

export const deleteReturningMany = async <T extends Record<string, unknown>>(
  pool: CommonQueryMethods,
  {
    selectBeforeDeleteSql,
    deleteSql,
  }: {
    selectBeforeDeleteSql: SqlSqlToken;
    deleteSql: SqlSqlToken;
  }
): Promise<{ rows: readonly T[]; rowCount: number }> => {
  if (getDatabaseDialectFromEnv() === DatabaseDialect.MariaDB) {
    const rows = await pool.any<T>(selectBeforeDeleteSql);
    const { rowCount } = await pool.query(deleteSql);
    return { rows, rowCount };
  }

  const { rows, rowCount } = await pool.query<T>(deleteSql);
  return { rows, rowCount };
};
