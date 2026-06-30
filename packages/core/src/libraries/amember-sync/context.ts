import {
  buildProductRoleName,
  isProductRoleName,
  wasRecentlyPushedToAMember,
  type AMemberSyncContext,
  type AMemberUser,
  type LogtoUserRecord,
} from '@logto/plugin-amember-sync';
import {
  buildAMemberCustomData,
  buildAMemberUserProfile,
  getAMemberUserIdFromCustomData,
  buildAMemberPhoneUpdate,
  buildAMemberSuspensionUpdate,
  resolveAMemberPasswordImport,
  resolveAMemberPrimaryPhone,
  resolveAMemberUserIdentity,
  truncateRoleDescription,
} from '@logto/plugin-amember-sync';
import { RoleType, Roles, Users, type Role } from '@logto/schemas';
import { generateStandardId } from '@logto/shared';
import { sql } from '@silverhand/slonik';

import type { UserLibrary } from '#src/libraries/user.js';
import { buildUserPasswordPayload } from '#src/libraries/user.utils.js';
import type Queries from '#src/tenants/Queries.js';
import { convertToIdentifiers } from '#src/utils/sql.js';

const { table: rolesTable, fields: roleFields } = convertToIdentifiers(Roles);
const { table: usersTable, fields: userFields } = convertToIdentifiers(Users);

export const createAMemberSyncContext = (
  queries: Queries,
  usersLibrary: Pick<UserLibrary, 'generateUserId' | 'insertUser' | 'signOutUser'>,
  { syncPasswords }: { syncPasswords: boolean }
): AMemberSyncContext => {
  const {
    roles: { insertRole, updateRoleById, deleteRoleById, findRolesByRoleIds },
    users: { updateUserById },
    usersRoles: { findUsersRolesByUserId, insertUsersRoles, deleteUsersRolesByUserIdAndRoleId },
  } = queries;
  const { generateUserId, insertUser, signOutUser } = usersLibrary;

  const findAMemberRoles = async () =>
    queries.pool.any<Role>(sql`
      select ${sql.join(Object.values(roleFields), sql`, `)}
      from ${rolesTable}
      where ${roleFields.name} ~ ${'^[0-9]+:'}
        or ${roleFields.name} like ${'aMember: %'}
    `);

  const findUsersIndexed = async () => {
    const users = await queries.pool.any<LogtoUserRecord>(sql`
      select
        ${userFields.id},
        ${userFields.primaryEmail},
        ${userFields.username},
        ${userFields.customData},
        ${userFields.passwordEncrypted},
        ${userFields.passwordEncryptionMethod}
      from ${usersTable}
      where ${userFields.primaryEmail} is not null
        or ${userFields.username} is not null
        or ${userFields.customData} ? 'amember'
    `);

    const byEmail = new Map<string, LogtoUserRecord>();
    const byUsername = new Map<string, LogtoUserRecord>();
    const byAMemberUserId = new Map<number, LogtoUserRecord>();

    for (const user of users) {
      if (user.primaryEmail) {
        byEmail.set(user.primaryEmail.toLowerCase(), user);
      }

      if (user.username) {
        byUsername.set(user.username.toLowerCase(), user);
      }

      const amemberUserId = getAMemberUserIdFromCustomData(user.customData);

      if (amemberUserId !== undefined) {
        byAMemberUserId.set(amemberUserId, user);
      }
    }

    return { byEmail, byUsername, byAMemberUserId };
  };

  const buildPasswordPayload = (user: AMemberUser, existing?: LogtoUserRecord) => {
    if (!syncPasswords) {
      return {};
    }

    const imported = resolveAMemberPasswordImport(user);

    if (!imported) {
      return {};
    }

    if (
      existing?.passwordEncrypted === imported.passwordEncrypted &&
      existing?.passwordEncryptionMethod === imported.passwordEncryptionMethod
    ) {
      return {};
    }

    return buildUserPasswordPayload(imported);
  };

  return {
    findAMemberRoles,
    createAMemberRole: async (productId, title, description) =>
      insertRole({
        id: generateStandardId(),
        name: buildProductRoleName(productId, title),
        description: truncateRoleDescription(description),
        type: RoleType.User,
      }),
    updateAMemberRole: async (roleId, productId, title, description) => {
      await updateRoleById(roleId, {
        name: buildProductRoleName(productId, title),
        description: truncateRoleDescription(description),
      });
    },
    deleteAMemberRole: async (roleId) => {
      await deleteRoleById(roleId);
    },
    findUsersIndexed,
    createUserFromAMember: async (user) => {
      const identity = resolveAMemberUserIdentity(user);

      if (!identity || (!identity.email && !identity.username)) {
        throw new Error(`Cannot create user without login for aMember user ${user.userId}`);
      }

      const primaryPhone = resolveAMemberPrimaryPhone(user.mobileNumber, user.mobileAreaCode);

      const [created] = await insertUser({
        id: await generateUserId(),
        primaryEmail: identity.email,
        username: identity.username,
        name: user.name,
        profile: buildAMemberUserProfile(user),
        ...(primaryPhone && { primaryPhone }),
        customData: buildAMemberCustomData(user),
        ...buildAMemberSuspensionUpdate(user),
        ...buildPasswordPayload(user),
      });

      return {
        id: created.id,
        primaryEmail: created.primaryEmail,
        username: created.username,
        customData: (created.customData ?? {}) as Record<string, unknown>,
        passwordEncrypted: created.passwordEncrypted,
        passwordEncryptionMethod: created.passwordEncryptionMethod,
      };
    },
    updateUserFromAMember: async (userId, user) => {
      const identity = resolveAMemberUserIdentity(user);

      if (!identity) {
        return;
      }

      const existingUsers = await queries.users.findUsersByIds([userId]);
      const existing = existingUsers[0];

      if (existing && wasRecentlyPushedToAMember((existing.customData ?? {}) as Record<string, unknown>)) {
        return;
      }

      const passwordPayload = buildPasswordPayload(user, existing);
      const suspensionUpdate = buildAMemberSuspensionUpdate(user);

      await updateUserById(userId, {
        primaryEmail: identity.email,
        username: identity.username,
        name: user.name,
        profile: buildAMemberUserProfile(user, existing?.profile),
        ...buildAMemberPhoneUpdate(user),
        customData: buildAMemberCustomData(
          user,
          (existing?.customData ?? {}) as Record<string, unknown>
        ),
        ...suspensionUpdate,
        ...passwordPayload,
      });

      if (suspensionUpdate.isSuspended && !existing?.isSuspended) {
        await signOutUser(userId);
      }
    },
    syncUserAMemberRoles: async (userId, productIds, roleByProductId) => {
      const desiredRoleIds = new Set(
        productIds
          .map((productId) => roleByProductId.get(productId)?.id)
          .filter((roleId): roleId is string => Boolean(roleId))
      );

      const currentAssignments = await findUsersRolesByUserId(userId);
      const currentRoleIds = currentAssignments.map(({ roleId }) => roleId);
      const currentRoles =
        currentRoleIds.length > 0 ? await findRolesByRoleIds(currentRoleIds) : [];
      const currentProductRoleIds = new Set(
        currentRoles.filter((role) => isProductRoleName(role.name)).map((role) => role.id)
      );

      let added = 0;
      let removed = 0;

      for (const roleId of desiredRoleIds) {
        if (!currentProductRoleIds.has(roleId)) {
          await insertUsersRoles([{ id: generateStandardId(), userId, roleId }]);
          added += 1;
        }
      }

      for (const roleId of currentProductRoleIds) {
        if (!desiredRoleIds.has(roleId)) {
          try {
            await deleteUsersRolesByUserIdAndRoleId(userId, roleId);
            removed += 1;
          } catch {
            // Assignment may already be gone.
          }
        }
      }

      return { added, removed };
    },
  };
};
