import { DatabaseDialect } from '@logto/database';
import { afterEach, describe, expect, it } from 'vitest';

import { resolveAlterationDialect } from './index.js';
import { getAlterationDirectory } from './utils.js';

describe('alteration dialect routing', () => {
  it('uses postgres alterations directory by default', () => {
    expect(getAlterationDirectory(DatabaseDialect.Postgres)).toContain('alterations-js');
  });

  it('uses mariadb alterations directory for MariaDB dialect', () => {
    expect(getAlterationDirectory(DatabaseDialect.MariaDB)).toContain('alterations-mariadb-js');
  });
});

describe('resolveAlterationDialect', () => {
  const originalDbUrl = process.env.DB_URL;

  afterEach(() => {
    if (originalDbUrl === undefined) {
      delete process.env.DB_URL;
    } else {
      process.env.DB_URL = originalDbUrl;
    }
  });

  it('prefers --dialect over positional and DB_URL', () => {
    process.env.DB_URL = 'postgres://localhost/logto';
    expect(resolveAlterationDialect('mariadb', 'postgres')).toBe(DatabaseDialect.MariaDB);
  });

  it('accepts bare positional dialect when npm swallows --dialect', () => {
    process.env.DB_URL = 'postgres://localhost/logto';
    expect(resolveAlterationDialect(undefined, 'mariadb')).toBe(DatabaseDialect.MariaDB);
  });

  it('falls back to DB_URL', () => {
    process.env.DB_URL = 'mariadb://localhost/logto';
    expect(resolveAlterationDialect()).toBe(DatabaseDialect.MariaDB);
  });
});
