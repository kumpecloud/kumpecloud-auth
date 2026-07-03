import { defaultTenantId, type AMemberSyncStoredConfig } from '@logto/schemas';
import { getEnv, yes } from '@silverhand/essentials';

import {
  amemberOutboundConfigGuard,
  amemberSyncConfigGuard,
  resolveInboundMode,
  toAMemberOutboundRuntimeConfig,
  toAMemberSyncRuntimeConfig,
  type AMemberOutboundConfig,
  type AMemberSyncConfig,
} from './types.js';
import { defaultDatabasePort, resolveDatabaseUrl } from './database-connection.js';

const parseIntervalSeconds = (value?: string) => {
  const parsed = Number(value ?? '3600');

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3600;
};

const parseDatabasePort = (value?: string) => {
  const parsed = Number(value ?? defaultDatabasePort);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultDatabasePort;
};

/**
 * Load aMember sync configuration from environment variables.
 */
export const loadAMemberSyncConfigFromEnv = (): AMemberSyncConfig | undefined => {
  if (!yes(getEnv('AMEMBER_SYNC_ENABLED'))) {
    return;
  }

  const inboundMode =
    (getEnv('AMEMBER_SYNC_INBOUND_MODE') as AMemberSyncStoredConfig['inboundMode'] | undefined) ??
    (getEnv('AMEMBER_SYNC_MODE', 'database') as AMemberSyncStoredConfig['inboundMode']);
  const tenantId = getEnv('AMEMBER_SYNC_TENANT_ID', defaultTenantId);
  const intervalSeconds = parseIntervalSeconds(getEnv('AMEMBER_SYNC_INTERVAL_SECONDS'));
  const syncPasswords = !yes(getEnv('AMEMBER_SYNC_SKIP_PASSWORDS'));
  const deleteLogtoUsersWhenRemovedFromAMember = yes(
    getEnv('AMEMBER_SYNC_DELETE_LOGTO_USERS_WHEN_REMOVED')
  );
  const roleSyncModeEnv = getEnv('AMEMBER_SYNC_ROLE_SYNC_MODE', 'one_way');
  const databaseUrl = resolveDatabaseUrl({
    databaseHost: getEnv('AMEMBER_DATABASE_HOST') || undefined,
    databasePort: getEnv('AMEMBER_DATABASE_PORT')
      ? parseDatabasePort(getEnv('AMEMBER_DATABASE_PORT'))
      : undefined,
    databaseUser: getEnv('AMEMBER_DATABASE_USER') || undefined,
    databasePassword: getEnv('AMEMBER_DATABASE_PASSWORD') || undefined,
    databaseName: getEnv('AMEMBER_DATABASE_NAME') || undefined,
    databaseUrl: getEnv('AMEMBER_DATABASE_URL') || undefined,
  });

  const config = {
    enabled: true as const,
    outboundEnabled: !yes(getEnv('AMEMBER_SYNC_OUTBOUND_DISABLED')),
    roleSyncMode:
      roleSyncModeEnv === 'two_way'
        ? ('two_way' as const)
        : ('one_way' as const),
    tenantId,
    intervalSeconds,
    syncPasswords,
    deleteLogtoUsersWhenRemovedFromAMember,
    inboundMode,
    tablePrefix: getEnv('AMEMBER_TABLE_PREFIX', 'am_'),
    databaseUrl,
    apiUrl: getEnv('AMEMBER_API_URL') || undefined,
    apiKey: getEnv('AMEMBER_API_KEY') || undefined,
  };

  const parsed = amemberSyncConfigGuard.safeParse(config);

  if (!parsed.success) {
    throw new Error(`Invalid aMember sync configuration: ${parsed.error.message}`);
  }

  return parsed.data;
};

/**
 * Load outbound-only aMember API credentials from environment variables.
 * Does not require inbound sync (`AMEMBER_SYNC_ENABLED`) to be set.
 */
export const loadAMemberOutboundConfigFromEnv = (): AMemberOutboundConfig | undefined => {
  if (yes(getEnv('AMEMBER_SYNC_OUTBOUND_DISABLED'))) {
    return;
  }

  const apiUrl = getEnv('AMEMBER_API_URL');
  const apiKey = getEnv('AMEMBER_API_KEY');

  if (!apiUrl || !apiKey) {
    return;
  }

  const roleSyncModeEnv = getEnv('AMEMBER_SYNC_ROLE_SYNC_MODE', 'one_way');
  const tenantId = getEnv('AMEMBER_SYNC_TENANT_ID', defaultTenantId);

  const parsed = amemberOutboundConfigGuard.safeParse({
    tenantId,
    roleSyncMode: roleSyncModeEnv === 'two_way' ? ('two_way' as const) : ('one_way' as const),
    apiUrl,
    apiKey,
  });

  if (!parsed.success) {
    return;
  }

  return parsed.data;
};

export const resolveAMemberOutboundConfig = (
  tenantId: string,
  stored?: AMemberSyncStoredConfig
): AMemberOutboundConfig | undefined => {
  const fromStored = stored ? toAMemberOutboundRuntimeConfig(tenantId, stored) : undefined;

  if (fromStored) {
    return fromStored;
  }

  const fromEnv = loadAMemberOutboundConfigFromEnv();

  if (fromEnv && fromEnv.tenantId === tenantId) {
    return fromEnv;
  }

  return;
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

export { resolveInboundMode };
