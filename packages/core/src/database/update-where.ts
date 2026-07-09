import type { SchemaLike, GeneratedSchema, SchemaValue } from '@logto/schemas';
import { asSqlFragment, DatabaseDialect, getQueryDialectFromUrl } from '@logto/database';
import type { UpdateWhereData } from '@logto/shared';
import type { Truthy } from '@silverhand/essentials';
import { notFalsy } from '@silverhand/essentials';
import type { CommonQueryMethods } from '@silverhand/slonik';
import { sql } from '@silverhand/slonik';

import { UpdateError } from '#src/errors/SlonikError/index.js';
import assertThat from '#src/utils/assert-that.js';
import { isKeyOf } from '#src/utils/schema.js';
import { convertToIdentifiers, convertToPrimitiveOrSql } from '#src/utils/sql.js';

type BuildUpdateWhere = {
  <
    Key extends string,
    CreateSchema extends Partial<SchemaLike<Key>>,
    Schema extends SchemaLike<Key>,
  >(
    schema: GeneratedSchema<Key, CreateSchema, Schema>,
    returning: true
  ): <SetKey extends Key, WhereKey extends Key>(
    data: UpdateWhereData<SetKey, WhereKey>
  ) => Promise<Schema>;
  <
    Key extends string,
    CreateSchema extends Partial<SchemaLike<Key>>,
    Schema extends SchemaLike<Key>,
  >(
    schema: GeneratedSchema<Key, CreateSchema, Schema>,
    returning?: false
  ): <SetKey extends Key, WhereKey extends Key>(
    data: UpdateWhereData<SetKey, WhereKey>
  ) => Promise<void>;
};

export const buildUpdateWhereWithPool =
  (pool: CommonQueryMethods): BuildUpdateWhere =>
  <
    Key extends string,
    CreateSchema extends Partial<SchemaLike<Key>>,
    Schema extends SchemaLike<Key>,
  >(
    schema: GeneratedSchema<Key, CreateSchema, Schema>,
    returning = false
  ) => {
    const { table, fields } = convertToIdentifiers(schema);
    const isKeyOfSchema = isKeyOf(schema);
    const queryDialect = getQueryDialectFromUrl(process.env.DB_URL ?? '');

    const connectKeyValueWithEqualSign = <ConnectKey extends Key>(
      data: Partial<SchemaLike<ConnectKey>>,
      jsonbMode: 'replace' | 'merge'
    ) =>
      Object.entries<SchemaValue>(data)
        .map(([key, value]) => {
          if (!isKeyOfSchema(key) || value === undefined) {
            return;
          }

          if (
            jsonbMode === 'merge' &&
            value &&
            typeof value === 'object' &&
            !Array.isArray(value)
          ) {
            return queryDialect.buildJsonMergeExpression(
              fields[key],
              convertToPrimitiveOrSql(key, value),
              'merge'
            );
          }

          return sql`${fields[key]}=${convertToPrimitiveOrSql(key, value)}`;
        })
        .filter((value): value is Truthy<typeof value> => notFalsy(value));

    return async <SetKey extends Key, WhereKey extends Key>({
      set,
      where,
      jsonbMode,
    }: UpdateWhereData<SetKey, WhereKey>) => {
      const whereConditions = connectKeyValueWithEqualSign(where, jsonbMode);
      const {
        rows: [data],
      } = await pool.query<Schema>(sql`
        update ${table}
        set ${sql.join(connectKeyValueWithEqualSign(set, jsonbMode), sql`, `)}
        where ${sql.join(whereConditions, sql` and `)}
        ${asSqlFragment(queryDialect.buildReturningClause(returning))}
      `);

      if (returning && queryDialect.dialect === DatabaseDialect.MariaDB && !data) {
        const { rows: [selected] } = await pool.query<Schema>(sql`
          select * from ${table}
          where ${sql.join(whereConditions, sql` and `)}
        `);

        assertThat(selected, new UpdateError(schema, { set, where, jsonbMode }));

        return selected;
      }

      assertThat(!returning || data, new UpdateError(schema, { set, where, jsonbMode }));

      return data;
    };
  };
