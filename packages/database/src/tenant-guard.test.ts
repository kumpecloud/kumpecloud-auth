import { describe, expect, it } from 'vitest';

import {
  assertTenantScopedSql,
  enforceTenantGuard,
  injectTenantIsolationPredicate,
  TenantGuardError,
  tenantSessionPredicate,
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

  it('blocks cross-tenant literal filters', () => {
    const violation = assertTenantScopedSql(
      `SELECT * FROM users WHERE tenant_id = 'tenant-b'`,
      defaultContext
    );

    expect(violation?.table).toBe('users');
    expect(violation?.reason).toContain('tenant-b');
  });

  it('scopes admin tenant like any other tenant (Postgres RLS parity)', () => {
    expect(assertTenantScopedSql(`SELECT * FROM users`, { tenantId: 'admin', isAdmin: true })).toEqual(
      expect.objectContaining({ table: 'users' })
    );

    const rewritten = injectTenantIsolationPredicate(`SELECT * FROM logto_configs WHERE key = ?`, {
      tenantId: 'admin',
      isAdmin: true,
    });

    expect(rewritten).toContain(tenantSessionPredicate);
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

    expect(['users', 'applications']).toContain(violation?.table);
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

  it('allows INSERT without tenant_id filter (session trigger fills it)', () => {
    expect(
      assertTenantScopedSql(
        `INSERT INTO logto_configs (key, value) VALUES ('k', '{}')`,
        defaultContext
      )
    ).toBeUndefined();
  });

  it('does not require tenant_id on systems (global table)', () => {
    expect(assertTenantScopedSql(`SELECT * FROM systems WHERE key = 'x'`, defaultContext)).toBeUndefined();
  });
});

describe('injectTenantIsolationPredicate', () => {
  it('injects session predicate before FOR UPDATE', () => {
    const rewritten = injectTenantIsolationPredicate(
      `select key from logto_configs where key in ('oidc.privateKeys') for update`,
      defaultContext
    );

    expect(rewritten).toBe(
      `select key from logto_configs where key in ('oidc.privateKeys') AND ${tenantSessionPredicate} for update`
    );
  });

  it('injects WHERE when missing', () => {
    const rewritten = injectTenantIsolationPredicate(`select * from users`, defaultContext);

    expect(rewritten).toBe(`select * from users WHERE ${tenantSessionPredicate}`);
  });

  it('leaves already-filtered SQL alone', () => {
    const sql = `select * from users where tenant_id = @logto_tenant_id and id = ?`;

    expect(injectTenantIsolationPredicate(sql, defaultContext)).toBe(sql);
  });

  it('does not inject into INSERT', () => {
    const sql = `insert into logto_configs (key, value) values (?, ?)`;

    expect(injectTenantIsolationPredicate(sql, defaultContext)).toBe(sql);
  });

  it('qualifies multi-table injects', () => {
    const rewritten = injectTenantIsolationPredicate(
      `SELECT * FROM users u JOIN applications a ON u.id = a.id`,
      defaultContext
    );

    expect(rewritten).toContain('users.tenant_id = @logto_tenant_id');
    expect(rewritten).toContain('applications.tenant_id = @logto_tenant_id');
  });

  it('injects before a trailing semicolon (not after statement end)', () => {
    const rewritten = injectTenantIsolationPredicate(
      `select * from users where id = ?;`,
      defaultContext
    );

    expect(rewritten).toBe(
      `select * from users where id = ? AND ${tenantSessionPredicate};`
    );
  });
});
