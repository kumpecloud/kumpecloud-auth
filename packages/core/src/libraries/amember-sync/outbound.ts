import {
  pushLogtoPasswordToAMember,
  pushLogtoRoleGrantsToAMember,
  pushLogtoUserToAMember,
  resolveAMemberOutboundConfig,
  type AMemberOutboundPushUser,
  type AMemberSyncLogger,
} from '@logto/plugin-amember-sync';
import { amemberSyncStoredConfigGuard, type JsonObject, type User } from '@logto/schemas';
import { ConsoleLog } from '@logto/shared';
import chalk from 'chalk';

import { tenantPool } from '#src/tenants/index.js';

const consoleLog = new ConsoleLog(chalk.cyan('amember-outbound'));

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

const toOutboundUser = (user: User): AMemberOutboundPushUser => ({
  id: user.id,
  username: user.username,
  primaryEmail: user.primaryEmail,
  primaryPhone: user.primaryPhone,
  name: user.name,
  profile: user.profile,
  customData: (user.customData ?? {}) as Record<string, unknown>,
});

const getOutboundConfig = async (tenantId: string) => {
  const tenant = await tenantPool.get(tenantId);
  const stored =
    (await tenant.queries.logtoConfigs.getAMemberSyncConfig()) ??
    amemberSyncStoredConfigGuard.parse({ enabled: false });
  const config = resolveAMemberOutboundConfig(tenantId, stored);

  if (!config) {
    logger.warn(
      `Skipping aMember outbound push for tenant "${tenantId}": enable outbound sync and save a valid API URL and key`
    );
    return;
  }

  return { tenant, config };
};

type OutboundTaskContext = {
  tenantId?: string;
  userId?: string;
};

const runSafely = async (task: () => Promise<void>, context?: OutboundTaskContext) => {
  try {
    await task();
  } catch (error: unknown) {
    if (error instanceof Error) {
      consoleLog.error('Outbound task failed', {
        err: error,
        name: error.name,
        message: error.message,
        stack: error.stack,
        tenantId: context?.tenantId,
        userId: context?.userId,
      });
      return;
    }

    consoleLog.error('Outbound task failed', {
      err: error,
      message: String(error),
      tenantId: context?.tenantId,
      userId: context?.userId,
    });
  }
};

export const pushCreatedUserToAMember = (
  tenantId: string,
  user: User,
  plainPassword?: string
) => {
  void runSafely(
    async () => {
    const resolved = await getOutboundConfig(tenantId);

    if (!resolved) {
      return;
    }

    const { tenant, config } = resolved;

    await pushLogtoUserToAMember({
      config,
      context: {
        updateUserCustomData: async (userId, customData) => {
          await tenant.queries.users.updateUserById(userId, {
            customData: customData as JsonObject,
          });
        },
      },
      logger,
      user: toOutboundUser(user),
      plainPassword,
    });
  },
    { tenantId, userId: user.id }
  );
};

export const pushUpdatedUserToAMember = (tenantId: string, userId: string) => {
  void runSafely(
    async () => {
    const resolved = await getOutboundConfig(tenantId);

    if (!resolved) {
      return;
    }

    const { tenant, config } = resolved;
    const user = await tenant.queries.users.findUserById(userId);

    await pushLogtoUserToAMember({
      config,
      context: {
        updateUserCustomData: async (id, customData) => {
          await tenant.queries.users.updateUserById(id, {
            customData: customData as JsonObject,
          });
        },
      },
      logger,
      user: toOutboundUser(user),
    });
  },
    { tenantId, userId }
  );
};

export const pushUserPasswordToAMember = (
  tenantId: string,
  userId: string,
  plainPassword: string
) => {
  void runSafely(
    async () => {
    const resolved = await getOutboundConfig(tenantId);

    if (!resolved) {
      return;
    }

    const { tenant, config } = resolved;
    const user = await tenant.queries.users.findUserById(userId);

    await pushLogtoPasswordToAMember({
      config,
      context: {
        updateUserCustomData: async (id, customData) => {
          await tenant.queries.users.updateUserById(id, {
            customData: customData as JsonObject,
          });
        },
      },
      logger,
      user: toOutboundUser(user),
      plainPassword,
    });
  },
    { tenantId, userId }
  );
};

export const pushUserRoleChangesToAMember = (
  tenantId: string,
  userId: string,
  {
    grantedRoleNames = [],
    revokedRoleNames = [],
  }: {
    grantedRoleNames?: string[];
    revokedRoleNames?: string[];
  }
) => {
  void runSafely(
    async () => {
    const resolved = await getOutboundConfig(tenantId);

    if (!resolved) {
      return;
    }

    const { tenant, config } = resolved;
    const user = await tenant.queries.users.findUserById(userId);

    await pushLogtoRoleGrantsToAMember({
      config,
      context: {
        updateUserCustomData: async (id, customData) => {
          await tenant.queries.users.updateUserById(id, {
            customData: customData as JsonObject,
          });
        },
      },
      logger,
      user: toOutboundUser(user),
      roleNames: grantedRoleNames,
      revokedRoleNames,
    });
  },
    { tenantId, userId }
  );
};
