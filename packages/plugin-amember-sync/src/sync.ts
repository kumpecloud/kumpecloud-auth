import { parseAMemberProductIdFromRoleName } from './constants.js';
import type { AMemberSyncContext, LogtoUserRecord } from './context.js';
import type { AMemberSyncConfig, AMemberSyncLogger, AMemberSyncStats, AMemberUser } from './types.js';
import { createAMemberDataSource } from './sources/index.js';
import {
  getAMemberUserIdFromCustomData,
  groupActiveAccessByUserId,
  indexProductsById,
  isAMemberUserActive,
  resolveAMemberUserIdentity,
  truncateRoleDescription,
} from './utils.js';

const emptyStats = (): AMemberSyncStats => ({
  productsCreated: 0,
  productsUpdated: 0,
  productsDeleted: 0,
  usersCreated: 0,
  usersUpdated: 0,
  usersSkipped: 0,
  roleAssignmentsAdded: 0,
  roleAssignmentsRemoved: 0,
  rolesRevokedDueToInactivity: 0,
});

const findLogtoUserForAMemberUser = (
  user: AMemberUser,
  indexes: {
    byEmail: Map<string, LogtoUserRecord>;
    byUsername: Map<string, LogtoUserRecord>;
    byAMemberUserId: Map<number, LogtoUserRecord>;
  }
) => {
  const byId = indexes.byAMemberUserId.get(user.userId);

  if (byId) {
    return byId;
  }

  const identity = resolveAMemberUserIdentity(user);

  if (!identity) {
    return;
  }

  if (identity.email) {
    const byEmail = indexes.byEmail.get(identity.email);

    if (byEmail) {
      return byEmail;
    }
  }

  if (identity.username) {
    return indexes.byUsername.get(identity.username.toLowerCase());
  }
};

export const runAMemberSync = async ({
  config,
  context,
  logger,
}: {
  config: AMemberSyncConfig;
  context: AMemberSyncContext;
  logger: AMemberSyncLogger;
}): Promise<AMemberSyncStats> => {
  const stats = emptyStats();
  const source = createAMemberDataSource(config);

  logger.info('Fetching aMember products, users, and access records...');
  const [products, users, accessRecords] = await Promise.all([
    source.getProducts(),
    source.getUsers(),
    source.getAccessRecords(),
  ]);

  const productsById = indexProductsById(products);
  const accessByUserId = groupActiveAccessByUserId(accessRecords);
  const activeAMemberUserIds = new Set<number>();
  const existingRoles = await context.findAMemberRoles();
  const roleByProductId = new Map<number, (typeof existingRoles)[number]>();

  for (const role of existingRoles) {
    const productId = parseAMemberProductIdFromRoleName(role.name);

    if (productId !== undefined) {
      roleByProductId.set(productId, role);
    }
  }

  logger.info(`Syncing ${products.length} aMember products to roles...`);
  for (const product of products) {
    const description = truncateRoleDescription(product.description ?? product.title);
    const existingRole = roleByProductId.get(product.productId);

    if (!existingRole) {
      const role = await context.createAMemberRole(product.productId, description);
      roleByProductId.set(product.productId, role);
      stats.productsCreated += 1;
      continue;
    }

    if (existingRole.description !== description) {
      await context.updateAMemberRole(existingRole.id, description);
      stats.productsUpdated += 1;
    }
  }

  for (const [productId, role] of roleByProductId) {
    if (!productsById.has(productId)) {
      await context.deleteAMemberRole(role.id);
      roleByProductId.delete(productId);
      stats.productsDeleted += 1;
    }
  }

  logger.info(`Syncing ${users.length} aMember users...`);
  const userIndexes = await context.findUsersIndexed();
  const logtoUserIdByAMemberUserId = new Map<number, string>();

  for (const user of users) {
    const identity = resolveAMemberUserIdentity(user);

    if (!identity || (!identity.email && !identity.username)) {
      logger.warn(`Skipping aMember user ${user.userId}: no usable login, email, or username`);
      stats.usersSkipped += 1;
      continue;
    }

    const existing = findLogtoUserForAMemberUser(user, userIndexes);

    if (!existing) {
      const created = await context.createUserFromAMember(user);

      if (created.primaryEmail) {
        userIndexes.byEmail.set(created.primaryEmail.toLowerCase(), created);
      }

      if (created.username) {
        userIndexes.byUsername.set(created.username.toLowerCase(), created);
      }

      userIndexes.byAMemberUserId.set(user.userId, created);
      logtoUserIdByAMemberUserId.set(user.userId, created.id);
      stats.usersCreated += 1;
    } else {
      await context.updateUserFromAMember(existing.id, user);
      logtoUserIdByAMemberUserId.set(user.userId, existing.id);
      stats.usersUpdated += 1;
    }

    if (isAMemberUserActive(user)) {
      activeAMemberUserIds.add(user.userId);
    }
  }

  logger.info('Syncing aMember access to user role assignments...');
  for (const [amemberUserId, productIds] of accessByUserId) {
    const logtoUserId = logtoUserIdByAMemberUserId.get(amemberUserId);

    if (!logtoUserId || !activeAMemberUserIds.has(amemberUserId)) {
      continue;
    }

    const { added, removed } = await context.syncUserAMemberRoles(
      logtoUserId,
      [...productIds],
      roleByProductId
    );
    stats.roleAssignmentsAdded += added;
    stats.roleAssignmentsRemoved += removed;
  }

  const revokeRolesForUser = async (logtoUserId: string) => {
    const { removed } = await context.syncUserAMemberRoles(logtoUserId, [], roleByProductId);

    if (removed > 0) {
      stats.roleAssignmentsRemoved += removed;
      stats.rolesRevokedDueToInactivity += removed;
    }
  };

  for (const amemberUserId of logtoUserIdByAMemberUserId.keys()) {
    if (activeAMemberUserIds.has(amemberUserId)) {
      continue;
    }

    const logtoUserId = logtoUserIdByAMemberUserId.get(amemberUserId);

    if (logtoUserId) {
      await revokeRolesForUser(logtoUserId);
    }
  }

  for (const [amemberUserId, logtoUser] of userIndexes.byAMemberUserId) {
    if (activeAMemberUserIds.has(amemberUserId) || accessByUserId.has(amemberUserId)) {
      continue;
    }

    await revokeRolesForUser(logtoUser.id);
  }

  logger.info(
    `aMember sync complete: ${stats.productsCreated} roles created, ${stats.productsUpdated} updated, ${stats.productsDeleted} deleted, ${stats.usersCreated} users created, ${stats.usersUpdated} updated, ${stats.usersSkipped} skipped, ${stats.roleAssignmentsAdded} role assignments added, ${stats.roleAssignmentsRemoved} removed, ${stats.rolesRevokedDueToInactivity} revoked due to inactivity`
  );

  return stats;
};

export { getAMemberUserIdFromCustomData };
