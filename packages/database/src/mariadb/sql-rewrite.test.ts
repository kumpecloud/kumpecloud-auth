import { describe, expect, it } from 'vitest';

import {
  rewriteDoubleQuotedIdentifiers,
  rewritePostgresSqlForMariaDB,
} from './slonik-pool.js';

describe('rewritePostgresSqlForMariaDB', () => {
  it('converts double-quoted identifiers to backticks', () => {
    expect(
      rewriteDoubleQuotedIdentifiers(`insert into "tenants" ("id", "db_user") values ('default', 'x')`)
    ).toBe('insert into `tenants` (`id`, `db_user`) values (\'default\', \'x\')');
  });

  it('does not rewrite quotes inside string literals', () => {
    expect(rewriteDoubleQuotedIdentifiers(`select 'say "hello"' as "label"`)).toBe(
      `select 'say "hello"' as \`label\``
    );
  });

  it('rewrites Postgres regex and jsonb key-existence operators', () => {
    const withRegex = rewritePostgresSqlForMariaDB(
      `select * from roles where name ~ '^[0-9]+:' or name ~* 'amember'`
    );
    expect(withRegex).toContain('REGEXP BINARY');
    expect(withRegex).toContain('REGEXP');
    expect(withRegex).not.toMatch(/\s~\s|\s~\*\s/);

    expect(
      rewritePostgresSqlForMariaDB(`select * from users where custom_data ? 'amember'`)
    ).toBe(`select * from users where JSON_CONTAINS_PATH(custom_data, 'one', '$.amember')`);
  });
});
