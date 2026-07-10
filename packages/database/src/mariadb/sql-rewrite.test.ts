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

  it('applies identifier rewrite in the full rewriter', () => {
    expect(rewritePostgresSqlForMariaDB(`select "id" from "users"`)).toBe(
      'select `id` from `users`'
    );
  });
});
