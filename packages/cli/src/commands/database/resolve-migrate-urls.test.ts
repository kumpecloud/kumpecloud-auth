import { describe, expect, it } from 'vitest';

import { buildPostgresUrlFromEnv, resolveMigrateUrls } from './resolve-migrate-urls.js';

describe('buildPostgresUrlFromEnv', () => {
  it('returns undefined without password', () => {
    expect(buildPostgresUrlFromEnv({})).toBeUndefined();
    expect(buildPostgresUrlFromEnv({ POSTGRES_PASSWORD: '' })).toBeUndefined();
  });

  it('builds compose-default URL and encodes password', () => {
    expect(
      buildPostgresUrlFromEnv({
        POSTGRES_PASSWORD: 'p@ss/word',
      })
    ).toBe('postgres://postgres:p%40ss%2Fword@postgres:5432/logto');
  });
});

describe('resolveMigrateUrls', () => {
  it('prefers CLI flags over env', () => {
    expect(
      resolveMigrateUrls(
        {
          from: 'postgres://u:p@pg:5432/logto',
          to: 'mariadb://u:p@mdb:3306/logto',
        },
        {
          MIGRATE_FROM_URL: 'postgres://ignored',
          DB_URL: 'mariadb://ignored',
        }
      )
    ).toEqual({
      fromUrl: 'postgres://u:p@pg:5432/logto',
      toUrl: 'mariadb://u:p@mdb:3306/logto',
    });
  });

  it('uses DB_URL for MariaDB target and MIGRATE_FROM_URL for source', () => {
    expect(
      resolveMigrateUrls(
        {},
        {
          DB_URL: 'mariadb://logto:secret@mariadb:3306/logto',
          MIGRATE_FROM_URL: 'postgres://postgres:secret@postgres:5432/logto',
        }
      )
    ).toEqual({
      fromUrl: 'postgres://postgres:secret@postgres:5432/logto',
      toUrl: 'mariadb://logto:secret@mariadb:3306/logto',
    });
  });

  it('builds Postgres URL from POSTGRES_* when migrate-from is unset', () => {
    expect(
      resolveMigrateUrls(
        {},
        {
          DB_URL: 'mariadb://logto:secret@external-db.example:3306/logto',
          POSTGRES_PASSWORD: 'secret',
          POSTGRES_HOST: 'legacy-pg',
        }
      )
    ).toEqual({
      fromUrl: 'postgres://postgres:secret@legacy-pg:5432/logto',
      toUrl: 'mariadb://logto:secret@external-db.example:3306/logto',
    });
  });

  it('rejects wrong dialects', () => {
    expect(() =>
      resolveMigrateUrls(
        {},
        {
          DB_URL: 'postgres://postgres:secret@postgres:5432/logto',
          MIGRATE_FROM_URL: 'postgres://postgres:secret@postgres:5432/logto',
        }
      )
    ).toThrow(/mariadb/);
  });
});
