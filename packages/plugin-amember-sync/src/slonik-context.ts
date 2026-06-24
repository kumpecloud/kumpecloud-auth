import { buildAMemberRoleName, isAMemberRoleName } from './constants.js';
import type { AMemberSyncContext, LogtoUserRecord } from './context.js';
import {
  buildAMemberCustomData,
  getAMemberUserIdFromCustomData,
  normalizeBcryptHash,
  resolveAMemberUserEmail,
  truncateRoleDescription,
} from './utils.js';
import { RoleType, UsersPasswordEncryptionMethod, type Role } from '@logto/schemas';
import { generateStandardId } from '@logto/shared';
import type { CommonQueryMethods } from '@silverhand/slonik';
import { sql } from '@silverhand/slonik';

const convertToTable = (table: string) => sql.identifier([table]);

export const createSlonikAMemberSyncContext = (
  pool: CommonQueryMethods,
  tenantId: string,
  { syncPasswords }: { syncPasswords: boolean }
): AMemberSyncContext => {
  const rolesTable = convertToTable('roles');
  const usersTable = convertToTable('users');
  const usersRolesTable = convertToTable('users_roles');

  const findAMemberRoles = async () =>
    pool.any<Role>(sql`
      select id, name, description, type, is_default as "isDefault", tenant_id as "tenantId"
      from ${rolesTable}
      where tenant_id = ${tenantId}
        and name like ${'aMember: %'}
    `);

  const findUsersIndexed = async () => {
    const users = await pool.any<LogtoUserRecord>(sql`
      select
        id,
        primary_email as "primaryEmail",
        custom_data as "customData",
        password_encrypted as "passwordEncrypted",
        password_encryption_method as "passwordEncryptionMethod"
      from ${usersTable}
      where tenant_id = ${tenantId}
        and (
          primary_email is not null
          or custom_data ? 'amember'
        )
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

  const assignDefaultRoles = async (userId: string) => {
    const defaultRoles = await pool.any<{ id: string }>(sql`
      select id
      from ${rolesTable}
      where tenant_id = ${tenantId}
        and is_default = true
        and type = ${RoleType.User}
    `);

    if (defaultRoles.length === 0) {
      return;
    }

    await pool.query(sql`
      insert into ${usersRolesTable} (tenant_id, id, user_id, role_id)
      values ${sql.join(
        defaultRoles.map(
          ({ id: roleId }) => sql`(${tenantId}, ${generateStandardId()}, ${userId}, ${roleId})`
        ),
        sql`, `
      )}
      on conflict do nothing
    `);
  };

  return {
    findAMemberRoles,
    createAMemberRole: async (productId, description) => {
      const role = {
        id: generateStandardId(),
        name: buildAMemberRoleName(productId),
        description: truncateRoleDescription(description),
        type: RoleType.User,
      };

      await pool.query(sql`
        insert into ${rolesTable} (tenant_id, id, name, description, type, is_default)
        values (${tenantId}, ${role.id}, ${role.name}, ${role.description}, ${role.type}, false)
      `);

      return { ...role, isDefault: false, tenantId };
    },
    updateAMemberRole: async (roleId, description) => {
      await pool.query(sql`
        update ${rolesTable}
        set description = ${truncateRoleDescription(description)}
        where tenant_id = ${tenantId}
          and id = ${roleId}
      `);
    },
    deleteAMemberRole: async (roleId) => {
      await pool.query(sql`
        delete from ${rolesTable}
        where tenant_id = ${tenantId}
          and id = ${roleId}
      `);
    },
    findUsersIndexed,
    createUserFromAMember: async (user) => {
      const email = resolveAMemberUserEmail(user);

      if (!email) {
        throw new Error(`Cannot create user without email for aMember user ${user.userId}`);
      }

      const userId = generateStandardId();
      const passwordEncrypted =
        syncPasswords && user.passwordHash
          ? normalizeBcryptHash(user.passwordHash)
          : null;
      const passwordEncryptionMethod = passwordEncrypted
        ? UsersPasswordEncryptionMethod.Bcrypt
        : null;

      await pool.query(sql`
        insert into ${usersTable} (
          tenant_id,
          id,
          primary_email,
          name,
          custom_data,
          password_encrypted,
          password_encryption_method,
          password_updated_at
        )
        values (
          ${tenantId},
          ${userId},
          ${email},
          ${user.name ?? null},
          ${sql.jsonb(buildAMemberCustomData(user.userId))},
          ${passwordEncrypted},
          ${passwordEncryptionMethod},
          ${passwordEncrypted ? Date.now() : null}
        )
      `);

      await assignDefaultRoles(userId);

      return {
        id: userId,
        primaryEmail: email,
        customData: buildAMemberCustomData(user.userId),
        passwordEncrypted,
        passwordEncryptionMethod,
      };
    },
    updateUserFromAMember: async (userId, user) => {
      const email = resolveAMemberUserEmail(user);

      if (!email) {
        return;
      }

      const existing = await pool.maybeOne<{
        customData: Record<string, unknown>;
        passwordEncrypted: string | null;
      }>(sql`
        select custom_data as "customData", password_encrypted as "passwordEncrypted"
        from ${usersTable}
        where tenant_id = ${tenantId}
          and id = ${userId}
      `);

      const nextPassword =
        syncPasswords && user.passwordHash ? normalizeBcryptHash(user.passwordHash) : null;
      const shouldUpdatePassword = Boolean(
        nextPassword && nextPassword !== existing?.passwordEncrypted
      );

      await pool.query(sql`
        update ${usersTable}
        set
          primary_email = ${email},
          name = ${user.name ?? null},
          custom_data = coalesce(custom_data, '{}'::jsonb) || ${sql.jsonb({
            amember: {
              userId: user.userId,
            },
          })},
          password_encrypted = case
            when ${shouldUpdatePassword} then ${nextPassword}
            else password_encrypted
          end,
          password_encryption_method = case
            when ${shouldUpdatePassword} then ${UsersPasswordEncryptionMethod.Bcrypt}
            else password_encryption_method
          end,
          password_updated_at = case
            when ${shouldUpdatePassword} then ${Date.now()}
            else password_updated_at
          end
        where tenant_id = ${tenantId}
          and id = ${userId}
      `);
    },
    syncUserAMemberRoles: async (userId, productIds, roleByProductId) => {
      const desiredRoleIds = new Set(
        productIds
          .map((productId) => roleByProductId.get(productId)?.id)
          .filter((roleId): roleId is string => Boolean(roleId))
      );

      const currentAssignments = await pool.any<{ roleId: string; roleName: string }>(sql`
        select users_roles.role_id as "roleId", roles.name as "roleName"
        from ${usersRolesTable} as users_roles
        inner join ${rolesTable} as roles on roles.id = users_roles.role_id
        where users_roles.tenant_id = ${tenantId}
          and users_roles.user_id = ${userId}
      `);

      const currentAMemberRoleIds = new Set(
        currentAssignments
          .filter((assignment) => isAMemberRoleName(assignment.roleName))
          .map((assignment) => assignment.roleId)
      );

      let added = 0;
      let removed = 0;

      for (const roleId of desiredRoleIds) {
        if (!currentAMemberRoleIds.has(roleId)) {
          await pool.query(sql`
            insert into ${usersRolesTable} (tenant_id, id, user_id, role_id)
            values (${tenantId}, ${generateStandardId()}, ${userId}, ${roleId})
            on conflict do nothing
          `);
          added += 1;
        }
      }

      for (const roleId of currentAMemberRoleIds) {
        if (!desiredRoleIds.has(roleId)) {
          const { rowCount } = await pool.query(sql`
            delete from ${usersRolesTable}
            where tenant_id = ${tenantId}
              and user_id = ${userId}
              and role_id = ${roleId}
          `);

          if (rowCount > 0) {
            removed += 1;
          }
        }
      }

      return { added, removed };
    },
  };
};
