import type { Role } from '@logto/schemas';

import { parseProductIdFromRoleName } from './constants.js';
import type { AMemberDataSource, AMemberSyncContext } from './context.js';
import type { AMemberSyncConfig, AMemberSyncLogger, AMemberUser } from './types.js';
import {
  getAMemberUserIdFromCustomData,
  isAccessActive,
  isAMemberUserActive,
  truncateRoleDescription,
} from './utils.js';

export type AMemberUserSyncStats = {
  amemberUserId: number;
  productIds: number[];
  roleAssignmentsAdded: number;
  roleAssignmentsRemoved: number;
};

export class AMemberUserNotFoundError extends Error {
  constructor() {
    super('aMember user not found');
    this.name = 'AMemberUserNotFoundError';
  }
}

export type LogtoUserForAMemberSync = {
  id: string;
  primaryEmail: string | null;
  username: string | null;
  customData: Record<string, unknown>;
};

const resolveAMemberUser = async ({
  source,
  logtoUser,
}: {
  source: AMemberDataSource;
  logtoUser: LogtoUserForAMemberSync;
}): Promise<{ amemberUserId: number; amemberUser: AMemberUser } | undefined> => {
  const linkedUserId = getAMemberUserIdFromCustomData(logtoUser.customData);

  if (linkedUserId !== undefined) {
    const amemberUser = await source.getUserById(linkedUserId);

    if (amemberUser) {
      return { amemberUserId: linkedUserId, amemberUser };
    }
  }

  const amemberUser = await source.findUserByLoginOrEmail({
    login: logtoUser.username ?? undefined,
    email: logtoUser.primaryEmail ?? undefined,
  });

  if (!amemberUser) {
    return;
  }

  return { amemberUserId: amemberUser.userId, amemberUser };
};

const buildRoleByProductId = async (context: AMemberSyncContext) => {
  const existingRoles = await context.findAMemberRoles();
  const roleByProductId = new Map<number, (typeof existingRoles)[number]>();

  for (const role of existingRoles) {
    const productId = parseProductIdFromRoleName(role.name);

    if (productId !== undefined) {
      roleByProductId.set(productId, role);
    }
  }

  return roleByProductId;
};

const ensureProductRoles = async ({
  context,
  source,
  productIds,
  roleByProductId,
}: {
  context: AMemberSyncContext;
  source: AMemberDataSource;
  productIds: number[];
  roleByProductId: Map<number, Role>;
}) => {
  const missingProductIds = productIds.filter((productId) => !roleByProductId.has(productId));

  if (missingProductIds.length === 0) {
    return;
  }

  const products = await source.getProductsByIds(missingProductIds);

  for (const product of products) {
    if (roleByProductId.has(product.productId)) {
      continue;
    }

    const description = truncateRoleDescription(product.description ?? product.title);
    const role = await context.createAMemberRole(product.productId, product.title, description);
    roleByProductId.set(product.productId, role);
  }
};

export const runAMemberSyncForUser = async ({
  config: _config,
  context,
  source,
  logger,
  logtoUser,
}: {
  config: AMemberSyncConfig;
  context: AMemberSyncContext;
  source: AMemberDataSource;
  logger: AMemberSyncLogger;
  logtoUser: LogtoUserForAMemberSync;
}): Promise<AMemberUserSyncStats> => {
  const resolved = await resolveAMemberUser({ source, logtoUser });

  if (!resolved) {
    throw new AMemberUserNotFoundError();
  }

  const { amemberUserId, amemberUser } = resolved;
  const roleByProductId = await buildRoleByProductId(context);

  if (!isAMemberUserActive(amemberUser)) {
    logger.info(
      `Revoking aMember product roles for Logto user ${logtoUser.id} because aMember user ${amemberUserId} is inactive`
    );
    const { removed } = await context.syncUserAMemberRoles(logtoUser.id, [], roleByProductId);

    return {
      amemberUserId,
      productIds: [],
      roleAssignmentsAdded: 0,
      roleAssignmentsRemoved: removed,
    };
  }

  const accessRecords = await source.getAccessRecordsForUser(amemberUserId);
  const productIds = [
    ...new Set(
      accessRecords.filter((access) => isAccessActive(access)).map((access) => access.productId)
    ),
  ];

  await ensureProductRoles({ context, source, productIds, roleByProductId });

  const { added, removed } = await context.syncUserAMemberRoles(
    logtoUser.id,
    productIds,
    roleByProductId
  );

  logger.info(
    `aMember user sync complete for Logto user ${logtoUser.id}: ${productIds.length} active products, ${added} role assignments added, ${removed} removed`
  );

  return {
    amemberUserId,
    productIds,
    roleAssignmentsAdded: added,
    roleAssignmentsRemoved: removed,
  };
};
