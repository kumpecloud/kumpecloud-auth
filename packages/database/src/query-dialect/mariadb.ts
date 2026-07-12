import { sql, type IdentifierSqlToken, type ValueExpression } from '@silverhand/slonik';

import { DatabaseDialect } from '../dialect.js';
import type { QueryDialect, UpsertOnConflictConfig } from '../types.js';

const quoteIdentifier = (name: string) => `\`${name.replaceAll('`', '``')}\``;

const toIdentifier = (value: string | IdentifierSqlToken): IdentifierSqlToken =>
  typeof value === 'string' ? sql.identifier([value]) : value;

/** Resolve a string or Slonik identifier token to a bare column name for VALUES(). */
export const resolveColumnName = (field: string | IdentifierSqlToken): string => {
  if (typeof field === 'string') {
    return field;
  }

  const name = field.names.at(-1);

  if (!name) {
    throw new TypeError('IdentifierSqlToken must include at least one name');
  }

  return name;
};

export const mariaQueryDialect: QueryDialect = {
  dialect: DatabaseDialect.MariaDB,

  buildOnConflictClause: (config?: UpsertOnConflictConfig) => {
    if (!config) {
      return sql``;
    }

    if (config.ignore) {
      return sql.raw('ON DUPLICATE KEY UPDATE tenant_id = tenant_id');
    }

    const updates = config.setExcludedFields
      .map((field) => {
        const name = resolveColumnName(field);
        return `${quoteIdentifier(name)} = VALUES(${quoteIdentifier(name)})`;
      })
      .join(', ');

    return sql.raw(`ON DUPLICATE KEY UPDATE ${updates}`);
  },

  buildReturningClause: () => sql``,

  buildJsonMergeExpression: (
    columnIdentifier: IdentifierSqlToken | string,
    value: ValueExpression,
    mode: 'merge' | 'replace'
  ) => {
    const column = toIdentifier(columnIdentifier);

    if (mode === 'replace') {
      return sql`${column}=${value}`;
    }

    return sql`${column}=JSON_MERGE_PATCH(COALESCE(${column}, JSON_OBJECT()), ${value})`;
  },

  buildLikeOperator: () => sql`LIKE`,

  buildSimilarToOperator: () => sql`REGEXP BINARY`,

  buildRegexOperator: (caseSensitive: boolean) => (caseSensitive ? sql`REGEXP BINARY` : sql`REGEXP`),

  buildExactOperator: () => sql`=`,

  buildValueListExpression: (values: string[], shouldLowercase: boolean) => {
    const normalized = shouldLowercase ? values.map((value) => value.toLowerCase()) : values;

    if (normalized.length === 1) {
      return sql`${normalized[0]!}`;
    }

    return sql`IN (${sql.join(
      normalized.map((value) => sql`${value}`),
      sql`, `
    )})`;
  },

  buildSearchKeywordPattern: (keyword: string) => `%${keyword}%`,
};
