import {
  buildAMemberRoleName,
  isAMemberRoleName,
  type AMemberSyncContext,
  type AMemberUser,
  type LogtoUserRecord,
} from '@logto/plugin-amember-sync';
import {
  buildAMemberCustomData,
  getAMemberUserIdFromCustomData,
  normalizeBcryptHash,
  resolveAMemberUserEmail,
  truncateRoleDescription,
} from '@logto/plugin-amember-sync';
import { RoleType, Roles, Users, UsersPasswordEncryptionMethod, type Role } from '@logto/schemas';
import { generateStandardId } from '@logto/shared';
import { sql } from '@silverhand/slonik';

import { buildUserPasswordPayload } from '#src/libraries/user.utils.js';
import type Queries from '#src/tenants/Queries.js';
import { convertToIdentifiers } from '#src/utils/sql.js';

const { table: rolesTable, fields: roleFields } = convertToIdentifiers(Roles);
const { table: usersTable, fields: userFields } = convertToIdentifiers(Users);

export const createAMemberSyncContext = (
  queries: Queries,
  { syncPasswords }: { syncPasswords: boolean }
): AMemberSyncContext => {
  const {
    roles: { insertRole, updateRoleById, deleteRoleById, findRolesByRoleIds },
    users: { generateUserId, insertUser, updateUserById },
    usersRoles: { findUsersRolesByUserId, insertUsersRoles, deleteUsersRolesByUserIdAndRoleId },
  } = queries;

  const findAMemberRoles = async () =>
    queries.pool.any<Role>(sql`
      select ${sql.join(Object.values(roleFields), sql`, `)}
      from ${rolesTable}
      where ${roleFields.name} like ${'aMember: %'}
    `);

  const findUsersIndexed = async () => {
    const users = await queries.pool.any<LogtoUserRecord>(sql`
      select
        ${userFields.id},
        ${userFields.primaryEmail},
        ${userFields.customData},
        ${userFields.passwordEncrypted},
        ${userFields.passwordEncryptionMethod}
      from ${usersTable}
      where ${userFields.primaryEmail} is not null
        or ${userFields.customData} ? 'amember'
    `);

    const byEmail = new Map<string, LogtoUserRecord>();
    const byAMemberUserId = new Map<number, LogtoUserRecord>();

    for (const user of users) {
      if (user.primaryEmail) {
        byEmail.set(user.primaryEmail.toLowerCase(), user);
      }

      const amemberUserId = getAMemberUserIdFromCustomData(user.customData);

      if (amemberUserId !== undefined) {
        byAMemberUserId.set(amemberUserId, user);
      }
    }

    return { byEmail, byAMemberUserId };
  };

  const buildPasswordPayload = (user: AMemberUser, existing?: LogtoUserRecord) => {
    if (!syncPasswords || !user.passwordHash) {
      return {};
    }

    const passwordEncrypted = normalizeBcryptHash(user.passwordHash);

    if (existing?.passwordEncrypted === passwordEncrypted) {
      return {};
    }

    return buildUserPasswordPayload({
      passwordEncrypted,
      passwordEncryptionMethod: UsersPasswordEncryptionMethod.Bcrypt,
    });
  };

  return {
    findAMemberRoles,
    createAMemberRole: async (productId, description) =>
      insertRole({
        id: generateStandardId(),
        name: buildAMemberRoleName(productId),
        description: truncateRoleDescription(description),
        type: RoleType.User,
      }),
    updateAMemberRole: async (roleId, description) => {
      await updateRoleById(roleId, { description: truncateRoleDescription(description) });
    },
    deleteAMemberRole: async (roleId) => {
      await deleteRoleById(roleId);
    },
    findUsersIndexed,
    createUserFromAMember: async (user) => {
      const email = resolveAMemberUserEmail(user);

      if (!email) {
        throw new Error(`Cannot create user without email for aMember user ${user.userId}`);
      }

      const [created] = await insertUser({
        id: await generateUserId(),
        primaryEmail: email,
        name: user.name,
        customData: buildAMemberCustomData(user.userId),
        ...buildPasswordPayload(user),
      });

      return {
        id: created.id,
        primaryEmail: created.primaryEmail,
        customData: (created.customData ?? {}) as Record<string, unknown>,
        passwordEncrypted: created.passwordEncrypted,
        passwordEncryptionMethod: created.passwordEncryptionMethod,
      };
    },
    updateUserFromAMember: async (userId, user) => {
      const email = resolveAMemberUserEmail(user);

      if (!email) {
        return;
      }

      const existingUsers = await queries.users.findUsersByIds([userId]);
      const existing = existingUsers[0];
      const passwordPayload = buildPasswordPayload(user, existing);

      await updateUserById(userId, {
        primaryEmail: email,
        name: user.name,
        customData: buildAMemberCustomData(
          user.userId,
          (existing?.customData ?? {}) as Record<string, unknown>
        ),
        ...passwordPayload,
      });
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
      const currentAMemberRoleIds = new Set(
        currentRoles.filter((role) => isAMemberRoleName(role.name)).map((role) => role.id)
      );

      let added = 0;
      let removed = 0;

      for (const roleId of desiredRoleIds) {
        if (!currentAMemberRoleIds.has(roleId)) {
          await insertUsersRoles([{ id: generateStandardId(), userId, roleId }]);
          added += 1;
        }
      }

      for (const roleId of currentAMemberRoleIds) {
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
