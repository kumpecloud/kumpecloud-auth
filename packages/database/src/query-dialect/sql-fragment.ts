import { sql, type SqlSqlToken } from '@silverhand/slonik';

/** Coerce dialect SQL output (string or Slonik token) into a safe Slonik fragment. */
export const asSqlFragment = (fragment: SqlSqlToken | string): SqlSqlToken =>
  typeof fragment === 'string' ? sql.raw(fragment) : fragment;
