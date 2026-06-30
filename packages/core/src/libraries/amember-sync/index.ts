import { resolveAMemberSyncConfig, runAMemberSync, type AMemberSyncLogger } from '@logto/plugin-amember-sync';
import { amemberSyncStoredConfigGuard } from '@logto/schemas';
import { ConsoleLog } from '@logto/shared';
import chalk from 'chalk';

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
