import { describe, expect, it } from 'vitest';

import {
  assertTenantScopedSql,
  enforceTenantGuard,
  TenantGuardError,
  type TenantContext,
} from './tenant-guard.js';

const defaultContext: TenantContext = {
  tenantId: 'tenant-a',
  isAdmin: false,
};

describe('TenantGuard', () => {
  it('allows queries with matching tenant_id filter', () => {
    expect(
      assertTenantScopedSql(
        `SELECT * FROM users WHERE tenant_id = 'tenant-a' AND id = 'u1'`,
        defaultContext
      )
    ).toBeUndefined();
  });

  it('blocks cross-tenant reads', () => {
    const violation = assertTenantScopedSql(
      `SELECT * FROM users WHERE tenant_id = 'tenant-b'`,
      defaultContext
    );

    expect(violation?.table).toBe('users');
  });

  it('allows admin tenant to bypass filter checks', () => {
    expect(
      assertTenantScopedSql(`SELECT * FROM users`, { tenantId: 'admin', isAdmin: true })
    ).toBeUndefined();
  });

  it('throws TenantGuardError on enforcement', () => {
    expect(() => enforceTenantGuard(`SELECT * FROM users`, defaultContext)).toThrow(
      TenantGuardError
    );
  });
});
