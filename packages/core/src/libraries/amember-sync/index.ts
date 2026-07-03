import {
  AMemberDatabaseConnectionError,
  AMemberUserNotFoundError,
  createAMemberDataSource,
  getAMemberUserIdFromCustomData,
  resolveAMemberSyncConfig,
  runAMemberSync,
  runAMemberSyncForUser,
  setAMemberLinkage,
  type AMemberSyncLogger,
  type AMemberUserSyncStats,
} from '@logto/plugin-amember-sync';
import { amemberSyncStoredConfigGuard, type JsonObject } from '@logto/schemas';
import { ConsoleLog } from '@logto/shared';
import chalk from 'chalk';

import RequestError from '#src/errors/RequestError/index.js';
import { tenantPool } from '#src/tenants/index.js';

import { createAMemberSyncContext } from './context.js';

const consoleLog = new ConsoleLog(chalk.cyan('amember-sync'));

const logger: AMemberSyncLogger = {
  info: (message) => {
    consoleLog.info(message);
  },
  warn: (message) => {
    consoleLog.warn(message);
  },
  error: (message) => {
    consoleLog.error(message);
  },
};

let syncInProgress = false;

export const runTenantAMemberSync = async (tenantId: string) => {
  if (syncInProgress) {
    logger.warn('Skipping aMember sync because a previous run is still in progress');
    return;
  }

  syncInProgress = true;

  try {
    const tenant = await tenantPool.get(tenantId);
    const stored =
      (await tenant.queries.logtoConfigs.getAMemberSyncConfig()) ??
      amemberSyncStoredConfigGuard.parse({ enabled: false });
    const config = resolveAMemberSyncConfig(tenantId, stored);

    if (!config?.enabled) {
      return;
    }

    const context = createAMemberSyncContext(tenant.queries, tenant.libraries.users, {
      syncPasswords: config.syncPasswords,
    });

    await runAMemberSync({ config, context, logger });
  } catch (error: unknown) {
    logger.error(error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    syncInProgress = false;
  }
};

export const runAMemberSyncForLogtoUser = async (
  tenantId: string,
  userId: string
): Promise<AMemberUserSyncStats> => {
  const tenant = await tenantPool.get(tenantId);
  const stored =
    (await tenant.queries.logtoConfigs.getAMemberSyncConfig()) ??
    amemberSyncStoredConfigGuard.parse({ enabled: false });
  const config = resolveAMemberSyncConfig(tenantId, stored);

  if (!config?.enabled) {
    throw new RequestError({
      code: 'user.amember_sync_not_configured',
      status: 503,
    });
  }

  const user = await tenant.queries.users.findUserById(userId);
  const customData = (user.customData ?? {}) as Record<string, unknown>;

  try {
    const context = createAMemberSyncContext(tenant.queries, tenant.libraries.users, {
      syncPasswords: config.syncPasswords,
    });
    const source = createAMemberDataSource(config);
    const stats = await runAMemberSyncForUser({
      config,
      context,
      source,
      logger,
      logtoUser: {
        id: user.id,
        primaryEmail: user.primaryEmail,
        username: user.username,
        customData,
      },
    });

    const linkedUserId = getAMemberUserIdFromCustomData(customData);

    if (linkedUserId === undefined) {
      await tenant.queries.users.updateUserById(userId, {
        customData: setAMemberLinkage(customData, stats.amemberUserId) as JsonObject,
      });
    }

    return stats;
  } catch (error: unknown) {
    if (error instanceof AMemberUserNotFoundError) {
      throw new RequestError({
        code: 'user.amember_user_not_found',
        status: 404,
      });
    }

    if (error instanceof AMemberDatabaseConnectionError) {
      throw new RequestError(
        {
          code: 'application.amember_sync_database_connection_failed',
          status: 503,
          message: error.message,
        },
        { message: error.message, host: error.host, port: error.port }
      );
    }

    throw error;
  }
};

export const startAMemberSyncScheduler = () => {
  void (async () => {
    try {
      const tenant = await tenantPool.get('default');
      const stored = await tenant.queries.logtoConfigs.getAMemberSyncConfig();
      const config = resolveAMemberSyncConfig('default', stored);

      if (!config?.enabled) {
        return;
      }

      const intervalMs = config.intervalSeconds * 1000;

      consoleLog.info(
        `Starting aMember sync scheduler for tenant "${config.tenantId}" every ${config.intervalSeconds}s (inbound: ${config.inboundMode})`
      );

      void runTenantAMemberSync(config.tenantId).catch(() => {
        // Errors are logged in runTenantAMemberSync.
      });

      setInterval(() => {
        void runTenantAMemberSync(config.tenantId).catch(() => {
          // Errors are logged in runTenantAMemberSync.
        });
      }, intervalMs);
    } catch (error: unknown) {
      consoleLog.error(error instanceof Error ? error.message : String(error));
    }
  })();
};
