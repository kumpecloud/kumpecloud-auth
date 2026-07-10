import { DatabaseDialect } from '@logto/database';
import { readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { getTablesDirectory } from './tables.js';

describe('getTablesDirectory', () => {
  it('uses tables-mariadb for MariaDB dialect', async () => {
    const directory = getTablesDirectory(DatabaseDialect.MariaDB);
    expect(directory.endsWith('tables-mariadb')).toBe(true);

    const files = await readdir(directory);
    expect(files).toContain('tenants.sql');
  });
});
