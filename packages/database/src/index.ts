import { assert } from '@silverhand/essentials';

import { DatabaseDialect, parseDatabaseUrl } from './dialect.js';
import { createMariaPool } from './mariadb/pool.js';
import { createMockPostgresPool, createPostgresPool } from './postgres/pool.js';
import type { DatabasePool, PoolFactoryOptions } from './types.js';

export {
  DatabaseDialect,
  getDatabaseDialectFromUrl,
  isMariaDatabaseDialect,
  isPostgresDatabaseDialect,
  parseDatabaseUrl,
} from './dialect.js';
export type { ParsedDatabaseUrl } from './dialect.js';

export { createPostgresPool, createMockPostgresPool, verifyPostgresPool } from './postgres/pool.js';
export { createMariaPool, verifyMariaPool } from './mariadb/pool.js';
export { parseDsn, stringifyDsn } from '@silverhand/slonik';

export type {
  DatabasePool,
  MariaDatabasePool,
  PoolFactoryOptions,
  PostgresDatabasePool,
  QueryDialect,
  UpsertOnConflictConfig,
} from './types.js';

export { isMariaDatabasePool, isPostgresDatabasePool } from './types.js';

export { ensureDatabasePoolReady } from './ensure-pool-ready.js';
export type { PoolLike } from './ensure-pool-ready.js';

export {
  getQueryDialect,
  getQueryDialectFromUrl,
  mariaQueryDialect,
  postgresQueryDialect,
} from './query-dialect/index.js';
export { asSqlFragment } from './query-dialect/sql-fragment.js';

export {
  buildDateGroupExpression,
  buildEmptyJsonArray,
  buildEmptyStringArray,
  buildGrantIdInAuthorizationsExists,
  buildIdentityUserIdEquals,
  buildInArrayCondition,
  buildJsonCoalesceMerge,
  buildJsonContains,
  buildJsonHasKey,
  buildJsonRemoveKey,
  buildOnConflictDoNothing,
  buildTimestampFromMillis,
  getDatabaseDialectFromEnv,
} from './sql-helpers.js';

export { normalizeJsonStringArray, normalizeJsonValue } from './json-normalize.js';
export { getMariaReturningLookupKeys } from './returning-lookup.js';
export { oidcPayloadJsonPaths, userIdentitiesJsonPaths } from './json-paths.js';

export {
  assertTenantScopedSql,
  buildTenantSessionStatements,
  enforceTenantGuard,
  injectTenantIsolationPredicate,
  tenantScopedTableNames,
  tenantSessionPredicate,
  TenantGuardError,
  wrapPoolWithTenantGuard,
} from './tenant-guard.js';
export type { TenantContext, TenantGuardViolation } from './tenant-guard.js';

export const createDatabasePool = async (
  databaseUrl: string,
  options?: PoolFactoryOptions
): Promise<DatabasePool> => {
  if (options?.mockDatabaseConnection) {
    return createMockPostgresPool();
  }

  const parsed = parseDatabaseUrl(databaseUrl);
  assert(parsed.database, new Error('Database name is required'));

  if (parsed.dialect === DatabaseDialect.Postgres) {
    return createPostgresPool(databaseUrl, options);
  }

  return createMariaPool(databaseUrl, options);
};
