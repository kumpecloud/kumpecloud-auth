import { describe, expect, it } from 'vitest';

import { DatabaseDialect } from '../dialect.js';
import { getQueryDialect } from './index.js';

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
});
