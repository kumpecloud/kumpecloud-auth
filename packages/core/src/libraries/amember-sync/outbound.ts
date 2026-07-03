import {
  pushLogtoPasswordToAMember,
  pushLogtoRoleGrantsToAMember,
  pushLogtoUserToAMember,
  resolveAMemberOutboundConfig,
  validateAMemberOutboundUserProfile,
  type AMemberOutboundPushUser,
  type AMemberSyncLogger,
} from '@logto/plugin-amember-sync';
import { amemberSyncStoredConfigGuard, type JsonObject, type User, type UserProfile } from '@logto/schemas';
import { ConsoleLog } from '@logto/shared';
import chalk from 'chalk';

import RequestError from '#src/errors/RequestError/index.js';
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

const toAMemberProvisionRequestError = (error: unknown): RequestError => {
  const message = error instanceof Error ? error.message : String(error);

  return new RequestError(
    {
      code: 'user.amember_provision_failed',
      status: 502,
      message,
    },
    { message }
  );
};

const getOutboundConfig = async (tenantId: string) => {
  const tenant = await tenantPool.get(tenantId);
  const stored =
    (await tenant.queries.logtoConfigs.getAMemberSyncConfig()) ??
    amemberSyncStoredConfigGuard.parse({ enabled: false });
  const config = resolveAMemberOutboundConfig(tenantId, stored);

  if (!config) {
    return;
  }

  return { tenant, config };
};

export const requiresAMemberUserProvisioning = async (tenantId: string): Promise<boolean> => {
  const tenant = await tenantPool.get(tenantId);
  const stored =
    (await tenant.queries.logtoConfigs.getAMemberSyncConfig()) ??
    amemberSyncStoredConfigGuard.parse({ enabled: false });

  return resolveAMemberOutboundConfig(tenantId, stored) !== undefined;
};

type AMemberUserCreateInput = {
  username?: string | null;
  primaryEmail?: string | null;
  password?: string;
  passwordEncrypted?: string;
  plainPassword?: string;
  profile?: UserProfile | null;
};

export const validateAMemberOutboundUserCreateInput = async (
  tenantId: string,
  input: AMemberUserCreateInput
): Promise<void> => {
  if (!(await requiresAMemberUserProvisioning(tenantId))) {
    return;
  }

  if (!input.primaryEmail?.trim()) {
    throw new RequestError({
      code: 'user.amember_email_required',
      status: 422,
    });
  }

  if (!input.username?.trim()) {
    throw new RequestError({
      code: 'user.amember_username_required',
      status: 422,
    });
  }

  const hasPassword =
    Boolean(input.plainPassword?.trim()) ||
    Boolean(input.password?.trim()) ||
    Boolean(input.passwordEncrypted);

  if (!hasPassword) {
    throw new RequestError({
      code: 'user.amember_password_required',
      status: 422,
    });
  }

  if (validateAMemberOutboundUserProfile(input.profile).length > 0) {
    throw new RequestError({
      code: 'user.amember_profile_required',
      status: 422,
    });
  }
};

const pushUserToAMember = async ({
  tenantId,
  user,
  plainPassword,
}: {
  tenantId: string;
  user: User;
  plainPassword?: string;
}) => {
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
};

/**
 * When outbound aMember sync is configured, create the matching aMember user before
 * completing Logto user creation. Throws if provisioning fails.
 */
export const provisionCreatedUserToAMember = async (
  tenantId: string,
  user: User,
  plainPassword?: string
): Promise<void> => {
  if (!(await requiresAMemberUserProvisioning(tenantId))) {
    return;
  }

  try {
    await pushUserToAMember({ tenantId, user, plainPassword });
  } catch (error: unknown) {
    consoleLog.error('aMember user provisioning failed', {
      err: error,
      tenantId,
      userId: user.id,
    });
    throw toAMemberProvisionRequestError(error);
  }
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

/** @deprecated Use {@link provisionCreatedUserToAMember} for user creation paths. */
export const pushCreatedUserToAMember = (
  tenantId: string,
  user: User,
  plainPassword?: string
) => {
  void runSafely(
    async () => {
      await pushUserToAMember({ tenantId, user, plainPassword });
    },
    { tenantId, userId: user.id }
  );
};

export const pushUpdatedUserToAMember = (tenantId: string, userId: string) => {
  void runSafely(
    async () => {
      const resolved = await getOutboundConfig(tenantId);

      if (!resolved) {
        logger.warn(
          `Skipping aMember outbound push for tenant "${tenantId}": enable outbound sync and save a valid API URL and key`
        );
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
