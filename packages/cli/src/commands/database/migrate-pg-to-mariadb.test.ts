import { describe, expect, it } from 'vitest';

import { checksumRows, filterMigrationPlan, getTableMigrationPlan, transformRow } from './migrate-pg-to-mariadb.js';

describe('getTableMigrationPlan', () => {
  it('returns tables in init_order sequence', async () => {
    const plan = await getTableMigrationPlan();

    expect(plan.length).toBeGreaterThan(50);
    expect(plan.some(({ table }) => table === 'users')).toBe(true);
    expect(plan.some(({ table }) => table === 'applications')).toBe(true);

    for (let index = 1; index < plan.length; index++) {
      const previous = plan[index - 1]!;
      const current = plan[index]!;

      expect(
        previous.initOrder < current.initOrder ||
          (previous.initOrder === current.initOrder && previous.table <= current.table)
      ).toBe(true);
    }
  });
});

describe('filterMigrationPlan', () => {
  it('supports resume-from and skip-tables', async () => {
    const plan = await getTableMigrationPlan();
    const usersIndex = plan.findIndex(({ table }) => table === 'users');

    expect(usersIndex).toBeGreaterThanOrEqual(0);

    const filtered = filterMigrationPlan(plan, {
      fromUrl: 'postgres://',
      toUrl: 'mariadb://',
      resumeFrom: 'users',
      skipTables: ['applications'],
    });

    expect(filtered[0]?.table).toBe('users');
    expect(filtered.some(({ table }) => table === 'applications')).toBe(false);
  });
});

describe('checksumRows', () => {
  it('is stable for row order', () => {
    const rows = [{ id: 'b' }, { id: 'a' }];

    expect(checksumRows(rows)).toBe(checksumRows([...rows].reverse()));
  });

  it('treats dialect-specific bool/date/json shapes as equal', () => {
    const postgresShaped = [
      {
        tenantId: 'admin',
        isThirdParty: false,
        createdAt: new Date('2026-07-09T00:46:16.154Z'),
        oidcClientMetadata: { postLogoutRedirectUris: [], redirectUris: [] },
      },
    ];
    const mariadbShaped = [
      {
        tenant_id: 'admin',
        is_third_party: 0,
        created_at: '2026-07-09 00:46:16.154',
        oidc_client_metadata: '{"redirectUris":[],"postLogoutRedirectUris":[]}',
        // Virtual columns exist only on MariaDB — must not affect checksum when filtered.
        protected_app_metadata_host: null,
        protected_app_metadata_custom_domain: null,
      },
    ];
    const columns = Object.keys(transformRow(postgresShaped[0]!)).sort();

    expect(checksumRows(postgresShaped, columns)).toBe(checksumRows(mariadbShaped, columns));
  });
});

describe('transformRowForMariaInsert', () => {
  it('decamelizes columns and normalizes timestamps/json', async () => {
    const { transformRowForMariaInsert, toSnakeCaseColumn, toMariaDbDateTime } = await import(
      './migrate-pg-to-mariadb.js'
    );

    expect(toSnakeCaseColumn('tenantId')).toBe('tenant_id');
    expect(toSnakeCaseColumn('oidc_client_metadata')).toBe('oidc_client_metadata');
    expect(toMariaDbDateTime('2026-07-09T00:46:16.154Z')).toBe('2026-07-09 00:46:16.154');

    expect(
      transformRowForMariaInsert({
        tenantId: 'admin',
        oidcClientMetadata: { redirectUris: [] },
        createdAt: 1_700_000_000_000,
        isThirdParty: false,
      })
    ).toEqual({
      tenant_id: 'admin',
      oidc_client_metadata: '{"redirectUris":[]}',
      created_at: toMariaDbDateTime(1_700_000_000_000),
      is_third_party: false,
    });
  });
});
