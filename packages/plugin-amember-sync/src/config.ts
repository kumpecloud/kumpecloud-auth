import { defaultTenantId, type AMemberSyncStoredConfig } from '@logto/schemas';
import { getEnv, yes } from '@silverhand/essentials';

import { amemberSyncConfigGuard, toAMemberSyncRuntimeConfig, type AMemberSyncConfig } from './types.js';

const parseIntervalSeconds = (value?: string) => {
  const parsed = Number(value ?? '3600');

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3600;
};

/**
 * Load aMember sync configuration from environment variables.
 */
export const loadAMemberSyncConfigFromEnv = (): AMemberSyncConfig | undefined => {
  if (!yes(getEnv('AMEMBER_SYNC_ENABLED'))) {
    return;
  }

  const mode = getEnv('AMEMBER_SYNC_MODE', 'api');
  const tenantId = getEnv('AMEMBER_SYNC_TENANT_ID', defaultTenantId);
  const intervalSeconds = parseIntervalSeconds(getEnv('AMEMBER_SYNC_INTERVAL_SECONDS'));
  const syncPasswords = !yes(getEnv('AMEMBER_SYNC_SKIP_PASSWORDS'));

  const base = {
    enabled: true,
    tenantId,
    intervalSeconds,
    syncPasswords,
  };

  const config =
    mode === 'database'
      ? {
          ...base,
          mode: 'database' as const,
          databaseUrl: getEnv('AMEMBER_DATABASE_URL') ?? '',
          tablePrefix: getEnv('AMEMBER_TABLE_PREFIX', 'am_'),
        }
      : {
          ...base,
          mode: 'api' as const,
          apiUrl: getEnv('AMEMBER_API_URL') ?? '',
          apiKey: getEnv('AMEMBER_API_KEY') ?? '',
        };

  const parsed = amemberSyncConfigGuard.safeParse(config);

  if (!parsed.success) {
    throw new Error(`Invalid aMember sync configuration: ${parsed.error.message}`);
  }

  return parsed.data;
};

export const resolveAMemberSyncConfig = (
  tenantId: string,
  stored?: AMemberSyncStoredConfig
): AMemberSyncConfig | undefined => {
  const fromStored = stored ? toAMemberSyncRuntimeConfig(tenantId, stored) : undefined;

  if (fromStored) {
    return fromStored;
  }

  const fromEnv = loadAMemberSyncConfigFromEnv();

  if (fromEnv && fromEnv.tenantId === tenantId) {
    return fromEnv;
  }

  return;
};
