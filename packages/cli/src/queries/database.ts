import { DatabaseDialect, getDatabaseDialectFromUrl } from '@logto/database';
import type { CommonQueryMethods } from '@silverhand/slonik';
import { sql } from '@silverhand/slonik';

export const getDatabaseName = async (pool: CommonQueryMethods, normalized = false) => {
  const dialect = getDatabaseDialectFromUrl(process.env.DB_URL ?? '');

  if (dialect === DatabaseDialect.MariaDB) {
    const { rows } = await pool.query<{ currentDatabase: string }>(sql`
      select database() as "currentDatabase"
    `);

    const currentDatabase = rows[0]?.currentDatabase ?? '';

    return normalized ? currentDatabase.replaceAll('-', '_') : currentDatabase;
  }

  const { currentDatabase } = await pool.one<{ currentDatabase: string }>(sql`
    select current_database();
  `);

  return normalized ? currentDatabase.replaceAll('-', '_') : currentDatabase;
};
