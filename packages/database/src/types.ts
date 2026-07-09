import type { DatabasePool as SlonikDatabasePool, QueryResult } from '@silverhand/slonik';

import type { MariaDatabasePool as MariaSlonikPool } from './mariadb/slonik-pool.js';

export type { SlonikDatabasePool };

/** Slonik-compatible pool used on the PostgreSQL path (unchanged behavior). */
export type PostgresDatabasePool = SlonikDatabasePool;

type SlonikQueryToken = {
  sql: string;
  type: 'SLONIK_TOKEN_SQL';
  values: readonly unknown[];
};

export type MariaDatabasePool = Omit<MariaSlonikPool, 'query' | 'one' | 'maybeOne'> & {
  readonly dialect: 'mariadb';
  query: {
    <R extends Record<string, unknown> = Record<string, unknown>>(
      sql: SlonikQueryToken
    ): Promise<QueryResult<R>>;
    <R extends Record<string, unknown> = Record<string, unknown>>(
      sql: string,
      values?: readonly unknown[]
    ): Promise<QueryResult<R>>;
  };
  one: {
    <R extends Record<string, unknown> = Record<string, unknown>>(
      sql: SlonikQueryToken
    ): Promise<R>;
    <R extends Record<string, unknown> = Record<string, unknown>>(
      sql: string,
      values?: readonly unknown[]
    ): Promise<R>;
  };
  maybeOne: {
    <R extends Record<string, unknown> = Record<string, unknown>>(
      sql: SlonikQueryToken
    ): Promise<R | null>;
    <R extends Record<string, unknown> = Record<string, unknown>>(
      sql: string,
      values?: readonly unknown[]
    ): Promise<R | null>;
  };
};

export type DatabasePool = PostgresDatabasePool | MariaDatabasePool;

export const isMariaDatabasePool = (pool: DatabasePool): pool is MariaDatabasePool =>
  'dialect' in pool && pool.dialect === 'mariadb';

export const isPostgresDatabasePool = (pool: DatabasePool): pool is PostgresDatabasePool =>
  !isMariaDatabasePool(pool);

export type PoolFactoryOptions = {
  maximumPoolSize?: number;
  connectionTimeout?: number;
  statementTimeout?: number | 'DISABLE_TIMEOUT';
  mockDatabaseConnection?: boolean;
};

export type UpsertOnConflictConfig =
  | {
      ignore: true;
    }
  | {
      ignore?: false;
      fields: readonly (string | import('@silverhand/slonik').IdentifierSqlToken)[];
      setExcludedFields: readonly (string | import('@silverhand/slonik').IdentifierSqlToken)[];
    };

export type QueryDialect = {
  readonly dialect: import('./dialect.js').DatabaseDialect;
  buildOnConflictClause: (config?: UpsertOnConflictConfig) => import('@silverhand/slonik').SqlSqlToken | string;
  buildReturningClause: (returning: boolean) => import('@silverhand/slonik').SqlSqlToken | string;
  buildJsonMergeExpression: (
    columnIdentifier: import('@silverhand/slonik').IdentifierSqlToken | string,
    value: import('@silverhand/slonik').ValueExpression,
    mode: 'merge' | 'replace'
  ) => import('@silverhand/slonik').SqlSqlToken | string;
  buildLikeOperator: (caseSensitive: boolean) => import('@silverhand/slonik').SqlSqlToken | string;
  buildSimilarToOperator: () => import('@silverhand/slonik').SqlSqlToken | string;
  buildRegexOperator: (caseSensitive: boolean) => import('@silverhand/slonik').SqlSqlToken | string;
  buildExactOperator: () => import('@silverhand/slonik').SqlSqlToken | string;
  buildValueListExpression: (
    values: string[],
    caseSensitive: boolean
  ) => import('@silverhand/slonik').SqlSqlToken | string;
  buildSearchKeywordPattern: (keyword: string) => string;
};
