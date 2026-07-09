import { isMariaDatabasePool, type DatabasePool } from './types.js';
import { verifyMariaPool } from './mariadb/pool.js';
import { verifyPostgresPool } from './postgres/pool.js';

export type PoolLike = Pick<DatabasePool, 'query' | 'end'>;

export const ensureDatabasePoolReady = async <T extends DatabasePool>(pool: T): Promise<T> => {
  if (isMariaDatabasePool(pool)) {
    await verifyMariaPool(pool);
  } else {
    await verifyPostgresPool(pool);
  }

  return pool;
};
