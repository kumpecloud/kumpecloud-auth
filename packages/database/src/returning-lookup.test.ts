import { describe, expect, it } from 'vitest';

import { getMariaReturningLookupKeys } from './returning-lookup.js';

describe('getMariaReturningLookupKeys', () => {
  it('prefers id when present', () => {
    expect(
      getMariaReturningLookupKeys(['id', 'name', 'tenantId'] as const, {
        id: 'abc',
        name: 'test',
        tenantId: 'default',
      })
    ).toEqual(['id']);
  });

  it('uses composite keys when id is absent', () => {
    expect(
      getMariaReturningLookupKeys(['userId', 'roleId', 'tenantId'] as const, {
        userId: 'u1',
        roleId: 'r1',
        tenantId: 'default',
      })
    ).toEqual(['userId', 'roleId']);
  });
});
