import { describe, expect, it } from 'vitest';

import { toAMemberOutboundRuntimeConfig } from './types.js';

describe('toAMemberOutboundRuntimeConfig', () => {
  it('returns outbound config when inbound sync is disabled but outbound API is configured', () => {
    expect(
      toAMemberOutboundRuntimeConfig('default', {
        enabled: false,
        outboundEnabled: true,
        apiUrl: 'https://billing.example.com/amember/api',
        apiKey: 'test-key',
      })
    ).toEqual({
      tenantId: 'default',
      roleSyncMode: 'one_way',
      apiUrl: 'https://billing.example.com/amember/api',
      apiKey: 'test-key',
    });
  });

  it('returns undefined when outbound sync is disabled', () => {
    expect(
      toAMemberOutboundRuntimeConfig('default', {
        enabled: true,
        outboundEnabled: false,
        apiUrl: 'https://billing.example.com/amember/api',
        apiKey: 'test-key',
      })
    ).toBeUndefined();
  });
});
