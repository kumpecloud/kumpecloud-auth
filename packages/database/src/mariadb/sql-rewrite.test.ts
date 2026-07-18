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

  it('rewrites jsonb text extract, timestamps, and casts', () => {
    expect(
      rewritePostgresSqlForMariaDB(`select payload->>'uid' from oidc_model_instances`)
    ).toBe(`select JSON_UNQUOTE(JSON_EXTRACT(payload, '$.uid')) from oidc_model_instances`);
    expect(
      rewritePostgresSqlForMariaDB(
        `select to_timestamp($1::double precision / 1000), to_timestamp($2)`
      )
    ).toBe(`select FROM_UNIXTIME($1 / 1000), FROM_UNIXTIME($2)`);
    expect(rewritePostgresSqlForMariaDB(`select json_build_object('id', id)`)).toBe(
      `select JSON_OBJECT('id', id)`
    );
    expect(
      rewritePostgresSqlForMariaDB(`select * from users where jsonb_array_length(mfa_verifications) > 0`)
    ).toBe(`select * from users where JSON_LENGTH(mfa_verifications) > 0`);
  });

  it('rewrites DISTINCT ON to DISTINCT', () => {
    const rewritten = rewritePostgresSqlForMariaDB(`
      select distinct on ("scopes"."id")
        "scopes"."id", "scopes"."name"
      from "organization_role_user_relations"
    `);
    expect(rewritten).toMatch(/select distinct\s+`scopes`\.`id`/i);
    expect(rewritten).not.toMatch(/distinct\s+on\s*\(/i);
  });

  it('rewrites empty select lists to select 1', () => {
    const rewritten = rewritePostgresSqlForMariaDB(`
      select
      from "organization_user_relations"
      where "organization_id" = $1
      limit 1
    `);
    expect(rewritten).toMatch(/select 1\s+from\s+`organization_user_relations`/i);
  });
});
