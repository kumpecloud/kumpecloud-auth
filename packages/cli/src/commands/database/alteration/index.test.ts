import { DatabaseDialect } from '@logto/database';
import { describe, expect, it } from 'vitest';

import { getAlterationDirectory } from './utils.js';

describe('alteration dialect routing', () => {
  it('uses postgres alterations directory by default', () => {
    expect(getAlterationDirectory(DatabaseDialect.Postgres)).toContain('alterations-js');
  });

  it('uses mariadb alterations directory for MariaDB dialect', () => {
    expect(getAlterationDirectory(DatabaseDialect.MariaDB)).toContain('alterations-mariadb-js');
  });
});
