import { type UserSignInCountry, UserSignInCountries } from '@logto/schemas';
import { DatabaseDialect, getDatabaseDialectFromEnv } from '@logto/database';
import { type CommonQueryMethods, sql } from '@silverhand/slonik';

import { convertToIdentifiers } from '#src/utils/sql.js';

const { table, fields } = convertToIdentifiers(UserSignInCountries);

export const createUserSignInCountriesQueries = (pool: CommonQueryMethods) => {
  const dialect = getDatabaseDialectFromEnv();

  const upsertUserSignInCountry = async (userId: string, country?: string) => {
    if (!country) {
      return;
    }

    if (dialect === DatabaseDialect.MariaDB) {
      await pool.query(sql`
        insert into ${table} (${fields.userId}, ${fields.country}, ${fields.lastSignInAt})
        values (${userId}, ${country}, now())
        on duplicate key update ${fields.lastSignInAt} = now()
      `);
      return;
    }

    await pool.query(sql`
      insert into ${table} (${fields.userId}, ${fields.country}, ${fields.lastSignInAt})
      values (${userId}, ${country}, now())
      on conflict (${fields.tenantId}, ${fields.userId}, ${fields.country})
      do update set ${fields.lastSignInAt} = now()
    `);
  };

  const findRecentSignInCountriesByUserId = async (userId: string, withinDays: number) => {
    const rows = await pool.any<UserSignInCountry>(sql`
      select ${sql.join(Object.values(fields), sql`, `)}
      from ${table}
      where ${fields.userId} = ${userId}
        and ${fields.lastSignInAt} >= ${
          dialect === DatabaseDialect.MariaDB
            ? sql`DATE_SUB(NOW(), INTERVAL ${withinDays} DAY)`
            : sql`now() - ${withinDays} * interval '1 day'`
        }
      order by ${fields.lastSignInAt} desc
    `);

    return rows.map(({ country, lastSignInAt }) => ({ country, lastSignInAt }));
  };

  const pruneUserSignInCountriesByUserId = async (userId: string, retentionDays: number) => {
    await pool.query(sql`
      delete from ${table}
      where ${fields.userId} = ${userId}
        and ${fields.lastSignInAt} < ${
          dialect === DatabaseDialect.MariaDB
            ? sql`DATE_SUB(NOW(), INTERVAL ${retentionDays} DAY)`
            : sql`now() - ${retentionDays} * interval '1 day'`
        }
    `);
  };

  return {
    upsertUserSignInCountry,
    findRecentSignInCountriesByUserId,
    pruneUserSignInCountriesByUserId,
  };
};
