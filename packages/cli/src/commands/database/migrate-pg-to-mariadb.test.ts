import { describe, expect, it } from 'vitest';

import { checksumRows, filterMigrationPlan, getTableMigrationPlan } from './migrate-pg-to-mariadb.js';

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
});
