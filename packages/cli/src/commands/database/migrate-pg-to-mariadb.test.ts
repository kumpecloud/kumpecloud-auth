import { describe, expect, it } from 'vitest';

import { getTableMigrationPlan } from './migrate-pg-to-mariadb.js';

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
