import {
  createMockPool,
  createMockQueryResult,
  createPool,
  createInterceptorsPreset,
  parseDsn,
  sql,
} from '@silverhand/slonik';

import type { PoolFactoryOptions, PostgresDatabasePool } from '../types.js';

export { parseDsn, stringifyDsn } from '@silverhand/slonik';

export const createMockPostgresPool = (): PostgresDatabasePool =>
  createMockPool({ query: async () => createMockQueryResult([]) });

export const createPostgresPool = async (
  databaseUrl: string,
  options: PoolFactoryOptions = {}
): Promise<PostgresDatabasePool> => {
  if (options.mockDatabaseConnection) {
    return createMockPostgresPool();
  }

  const dsn = parseDsn(databaseUrl);

  if (!dsn.databaseName) {
    throw new Error('Database name is required');
  }

  return createPool(databaseUrl, {
    interceptors: createInterceptorsPreset(),
    maximumPoolSize: options.maximumPoolSize,
    connectionTimeout: options.connectionTimeout,
    ...(options.statementTimeout === undefined
      ? {}
      : { statementTimeout: options.statementTimeout }),
  });
};

export const verifyPostgresPool = async (pool: PostgresDatabasePool) => {
  await pool.query(sql`select 1`);
  return pool;
};
