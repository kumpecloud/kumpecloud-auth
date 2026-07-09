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

  it('allows parameterized tenant_id filters', () => {
    expect(
      assertTenantScopedSql(`SELECT * FROM users WHERE tenant_id = ? AND id = ?`, defaultContext)
    ).toBeUndefined();
  });

  it('blocks multi-table queries without tenant_id filter', () => {
    const violation = assertTenantScopedSql(
      `SELECT * FROM users u JOIN applications a ON u.id = a.id`,
      defaultContext
    );

    expect(violation?.table).toBe('users');
    expect(violation?.reason).toContain('Multi-table');
  });

  it('allows multi-table queries with tenant_id filter', () => {
    expect(
      assertTenantScopedSql(
        `SELECT * FROM users u JOIN applications a ON u.id = a.id WHERE u.tenant_id = 'tenant-a' AND a.tenant_id = 'tenant-a'`,
        defaultContext
      )
    ).toBeUndefined();
  });

  it('throws TenantGuardError on enforcement', () => {
    expect(() => enforceTenantGuard(`SELECT * FROM users`, defaultContext)).toThrow(
      TenantGuardError
    );
  });
});
