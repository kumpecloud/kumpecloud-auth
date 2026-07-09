import {
  createDatabasePool,
  createMockPostgresPool,
  ensureDatabasePoolReady,
  parseDatabaseUrl,
  type DatabasePool,
  type PoolLike,
} from '@logto/database';
import { assert, conditional, trySafe } from '@silverhand/essentials';
import pRetry, { AbortError } from 'p-retry';

const databaseConnectionRetries = 5;
const transientConnectionErrorCodes = new Set([
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'EPIPE',
]);

const isErrorWithConnectionMetadata = (
  error: unknown
): error is {
  code?: string;
  message?: string;
} => typeof error === 'object' && error !== null;

export const ensurePoolReady = ensureDatabasePoolReady;

export const isTransientConnectionError = (error?: unknown) => {
  if (!isErrorWithConnectionMetadata(error)) {
    return false;
  }

  const { code, message } = error;

  if (typeof code === 'string' && transientConnectionErrorCodes.has(code)) {
    return true;
  }

  return typeof message === 'string' && message.toLowerCase().includes('timeout');
};

export const createPoolWithRetry = async <T extends PoolLike>(
  factory: () => Promise<T> | T,
  retries = databaseConnectionRetries
) =>
  pRetry(
    async () => {
      const pool = await (async () => {
        try {
          return await factory();
        } catch (error: unknown) {
          if (!isTransientConnectionError(error)) {
            throw new AbortError(error instanceof Error ? error : new Error(String(error)));
          }

          throw error;
        }
      })();

      try {
        return await ensurePoolReady(pool);
      } catch (error: unknown) {
        await trySafe(pool.end());

        if (!isTransientConnectionError(error)) {
          throw new AbortError(error instanceof Error ? error : new Error(String(error)));
        }

        throw error;
      }
    },
    {
      retries,
      minTimeout: 500,
      maxTimeout: 5000,
    }
  );

const createPoolByEnv = async (
  databaseDsn: string,
  mockDatabaseConnection: boolean,
  poolSize?: number,
  connectionTimeout?: number,
  statementTimeout?: number | 'DISABLE_TIMEOUT'
): Promise<DatabasePool> => {
  // Database connection is disabled in unit test environment
  if (mockDatabaseConnection) {
    return createMockPostgresPool();
  }

  assert(parseDatabaseUrl(databaseDsn).database, new Error('Database name is required'));

  const poolOptions = {
    maximumPoolSize: poolSize,
    connectionTimeout,
    ...conditional(statementTimeout !== undefined && { statementTimeout }),
  };

  return createPoolWithRetry(async () =>
    createDatabasePool(databaseDsn, poolOptions)
  );
};

export default createPoolByEnv;
