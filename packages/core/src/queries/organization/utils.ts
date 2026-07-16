import { OrganizationRoles } from '@logto/schemas';
import { DatabaseDialect, getDatabaseDialectFromEnv } from '@logto/database';
import {
  sql,
  type IdentifierSqlToken,
  type SqlSqlToken,
  type ValueExpression,
} from '@silverhand/slonik';

import { convertToIdentifiers } from '#src/utils/sql.js';

/**
 * Build the SQL for aggregating the organization roles with basic information (id and name)
 * into a JSON array.
 *
 * @param as The alias of the aggregated roles. Defaults to `organizationRoles`.
 */
export const aggregateRoles = (
  as = 'organizationRoles',
  dialect = getDatabaseDialectFromEnv()
): SqlSqlToken => {
  const roles = convertToIdentifiers(OrganizationRoles, true);

  if (dialect === DatabaseDialect.MariaDB) {
    // JSON_ARRAYAGG omits NULLs from left joins; COALESCE covers the empty case.
    return sql`
      coalesce(
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', ${roles.fields.id},
            'name', ${roles.fields.name}
          )
          ORDER BY ${roles.fields.name}
        ),
        JSON_ARRAY()
      ) as ${sql.identifier([as])}
    `;
  }

  return sql`
    coalesce(
      json_agg(
        json_build_object(
          'id', ${roles.fields.id},
          'name', ${roles.fields.name}
        ) order by ${roles.fields.name}
      ) filter (where ${roles.fields.id} is not null), -- left join could produce nulls as roles
      '[]'
    ) as ${sql.identifier([as])}
  `;
};

/** `array_remove(array_agg(col), null)` vs MariaDB `JSON_ARRAYAGG(col)`. */
export const aggregateNonNullIds = (
  column: IdentifierSqlToken,
  as: string,
  dialect = getDatabaseDialectFromEnv()
): SqlSqlToken => {
  if (dialect === DatabaseDialect.MariaDB) {
    return sql`
      coalesce(
        JSON_ARRAYAGG(${column}),
        JSON_ARRAY()
      ) as ${sql.identifier([as])}
    `;
  }

  return sql`
    array_remove(
      array_agg(${column}),
      null
    ) as ${sql.identifier([as])}
  `;
};

/**
 * Postgres `SELECT DISTINCT ON (id) cols…` vs MariaDB `SELECT DISTINCT cols…`.
 * Equivalent when `cols` come from a unique-keyed row (same values for a given id).
 */
export const buildSelectDistinctOn = (
  distinctColumn: IdentifierSqlToken,
  selectList: ValueExpression,
  dialect = getDatabaseDialectFromEnv()
): SqlSqlToken => {
  if (dialect === DatabaseDialect.MariaDB) {
    return sql`select distinct ${selectList}`;
  }

  return sql`select distinct on (${distinctColumn}) ${selectList}`;
};
