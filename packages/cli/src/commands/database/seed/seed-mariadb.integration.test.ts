import {
  createDatabasePool,
  DatabaseDialect,
  getDatabaseDialectFromUrl,
  type MariaDatabasePool,
} from '@logto/database';
import { describe, expect, it } from 'vitest';

import { createTables } from './tables.js';

const mariadbUrl = process.env.MARIADB_TEST_URL;

describe('MariaDB seed integration', () => {
  it.skipIf(!mariadbUrl || getDatabaseDialectFromUrl(mariadbUrl) !== DatabaseDialect.MariaDB)(
    'creates MariaDB tables from tables-mariadb/',
    async () => {
      const previousDbUrl = process.env.DB_URL;
      process.env.DB_URL = mariadbUrl;

      const pool = await createDatabasePool(mariadbUrl!);

      try {
        await pool.transaction(async (connection) => {
          await createTables(connection, false, DatabaseDialect.MariaDB);
        });

        const { rows } = await (pool as MariaDatabasePool).query<{ count: number }>(
          `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'`
        );

        expect(Number(rows[0]?.count ?? 0)).toBe(1);
      } finally {
        process.env.DB_URL = previousDbUrl;
        await pool.end();
      }
    },
    60_000
  );
});
