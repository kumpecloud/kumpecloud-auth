import { sql } from '@silverhand/slonik';
import { describe, expect, it } from 'vitest';

import { DatabaseDialect } from '../dialect.js';
import { getQueryDialect } from './index.js';
import { resolveColumnName } from './mariadb.js';

describe('getQueryDialect upsert', () => {
  it('builds postgres ON CONFLICT clause', () => {
    const dialect = getQueryDialect(DatabaseDialect.Postgres);
    const fragment = dialect.buildOnConflictClause({
      fields: ['tenant_id', 'id'],
      setExcludedFields: ['name'],
    });

    expect(fragment).toBeTruthy();
    expect(typeof fragment).toBe('object');
  });

  it('builds mariadb ON DUPLICATE KEY UPDATE clause', () => {
    const dialect = getQueryDialect(DatabaseDialect.MariaDB);
    const fragment = dialect.buildOnConflictClause({
      fields: ['tenant_id', 'id'],
      setExcludedFields: ['name'],
    });

    expect(fragment).toBeTruthy();
    expect(JSON.stringify(fragment)).toContain('ON DUPLICATE KEY UPDATE');
    expect(JSON.stringify(fragment)).toContain('VALUES(`name`)');
  });

  it('resolves Slonik identifier tokens to column names for MariaDB upserts', () => {
    expect(resolveColumnName('payload')).toBe('payload');
    expect(resolveColumnName(sql.identifier(['payload']))).toBe('payload');
    expect(resolveColumnName(sql.identifier(['oidc_model_instances', 'expires_at']))).toBe(
      'expires_at'
    );

    const dialect = getQueryDialect(DatabaseDialect.MariaDB);
    const fragment = dialect.buildOnConflictClause({
      fields: [sql.identifier(['tenant_id']), sql.identifier(['id'])],
      setExcludedFields: [sql.identifier(['payload']), sql.identifier(['expires_at'])],
    });

    const serialized = JSON.stringify(fragment);
    expect(serialized).toContain('`payload` = VALUES(`payload`)');
    expect(serialized).toContain('`expires_at` = VALUES(`expires_at`)');
    expect(serialized).not.toContain('[object Object]');
  });
});
