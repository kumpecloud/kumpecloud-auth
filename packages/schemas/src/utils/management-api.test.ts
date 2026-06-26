import { describe, expect, it } from 'vitest';

import { isManagementApi } from './management-api.js';

describe('isManagementApi', () => {
  it('recognizes KumpeCloud and legacy Logto indicators', () => {
    expect(isManagementApi('https://default.kumpe.app/api')).toBe(true);
    expect(isManagementApi('https://default.logto.app/api')).toBe(true);
    expect(isManagementApi('https://auth.stage.kumpe.app/api')).toBe(false);
    expect(isManagementApi('https://default.kumpe.app/me')).toBe(false);
  });
});
