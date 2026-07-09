import { sql, type IdentifierSqlToken, type ValueExpression } from '@silverhand/slonik';

import { DatabaseDialect } from '../dialect.js';
import type { QueryDialect, UpsertOnConflictConfig } from '../types.js';

const isIdentifier = (value: string | IdentifierSqlToken): value is IdentifierSqlToken =>
  typeof value !== 'string';

const toIdentifier = (value: string | IdentifierSqlToken) =>
  isIdentifier(value) ? value : sql.identifier([value]);

const setExcluded = (fields: readonly (string | IdentifierSqlToken)[]) =>
  sql.join(
    fields.map((field) => sql`${toIdentifier(field)}=excluded.${toIdentifier(field)}`),
    sql`, `
  );

export const postgresQueryDialect: QueryDialect = {
  dialect: DatabaseDialect.Postgres,

  buildOnConflictClause: (config?: UpsertOnConflictConfig) => {
    if (!config) {
      return sql``;
    }

    if (config.ignore) {
      return sql`on conflict do nothing`;
    }

    return sql`
      on conflict (${sql.join(
        config.fields.map((field) => toIdentifier(field)),
        sql`, `
      )}) do update
      set ${setExcluded(config.setExcludedFields)}
    `;
  },

  buildReturningClause: (returning: boolean) => (returning ? sql`returning *` : sql``),

  buildJsonMergeExpression: (
    columnIdentifier: IdentifierSqlToken | string,
    value: ValueExpression,
    mode: 'merge' | 'replace'
  ) => {
    const column = toIdentifier(columnIdentifier);

    if (mode === 'replace') {
      return sql`${column}=${value}`;
    }

    return sql`
      ${column}=
        coalesce(${column},'{}'::jsonb) || ${value}
    `;
  },

  buildLikeOperator: (caseSensitive: boolean) => (caseSensitive ? sql`~~` : sql`~~*`),

  buildSimilarToOperator: () => sql`similar to`,

  buildRegexOperator: (caseSensitive: boolean) => (caseSensitive ? sql`~` : sql`~*`),

  buildExactOperator: () => sql`=`,

  buildValueListExpression: (values: string[], shouldLowercase: boolean) => {
    const normalized = shouldLowercase ? values.map((value) => value.toLowerCase()) : values;

    return normalized.length === 1
      ? sql`${normalized[0]!}`
      : sql`any(${sql.array(normalized, 'varchar')})`;
  },

  buildSearchKeywordPattern: (keyword: string) => `%${keyword}%`,
};
