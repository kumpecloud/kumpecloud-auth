import { buildAMemberCustomData, buildAMemberUserProfile, type AMemberCustomData, wasRecentlyPushedToAMember } from './profile-fields.js';
import { buildProductRoleName, isProductRoleName } from './constants.js';
import type { AMemberSyncContext, LogtoUserRecord } from './context.js';
import {
  getAMemberUserIdFromCustomData,
  buildAMemberPhoneUpdate,
  buildAMemberSuspensionUpdate,
  resolveAMemberPasswordImport,
  resolveAMemberPrimaryPhone,
  resolveAMemberUserIdentity,
  truncateRoleDescription,
} from './utils.js';
import { RoleType, UsersPasswordEncryptionMethod, type Role } from '@logto/schemas';
import { generateStandardId, generateStandardShortId } from '@logto/shared';
import type { CommonQueryMethods } from '@silverhand/slonik';
import { sql } from '@silverhand/slonik';

const convertToTable = (table: string) => sql.identifier([table]);

/** Postgres `timestamptz` from JS epoch milliseconds (matches core `convertToPrimitiveOrSql`). */
const toTimestampFromMs = (milliseconds: number) =>
  sql`to_timestamp(${milliseconds}::double precision / 1000)`;

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
        and (
          name ~ ${'^[0-9]+:'}
          or name like ${'aMember: %'}
        )
    `);

  const findUsersIndexed = async () => {
    const users = await pool.any<LogtoUserRecord>(sql`
      select
        id,
        primary_email as "primaryEmail",
        username,
        custom_data as "customData",
        password_encrypted as "passwordEncrypted",
        password_encryption_method as "passwordEncryptionMethod"
      from ${usersTable}
      where tenant_id = ${tenantId}
        and (
          primary_email is not null
          or username is not null
          or custom_data ? 'amember'
        )
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
    createAMemberRole: async (productId, title, description) => {
      const role = {
        id: generateStandardId(),
        name: buildProductRoleName(productId, title),
        description: truncateRoleDescription(description),
        type: RoleType.User,
      };

      await pool.query(sql`
        insert into ${rolesTable} (tenant_id, id, name, description, type, is_default)
        values (${tenantId}, ${role.id}, ${role.name}, ${role.description}, ${role.type}, false)
      `);

      return { ...role, isDefault: false, tenantId };
    },
    updateAMemberRole: async (roleId, productId, title, description) => {
      await pool.query(sql`
        update ${rolesTable}
        set
          name = ${buildProductRoleName(productId, title)},
          description = ${truncateRoleDescription(description)}
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
      const identity = resolveAMemberUserIdentity(user);

      if (!identity || (!identity.email && !identity.username)) {
        throw new Error(`Cannot create user without login for aMember user ${user.userId}`);
      }

      const userId = generateStandardShortId();
      const importedPassword = syncPasswords ? resolveAMemberPasswordImport(user) : undefined;
      const passwordEncrypted = importedPassword?.passwordEncrypted ?? null;
      const passwordEncryptionMethod = importedPassword?.passwordEncryptionMethod ?? null;
      const primaryPhone = resolveAMemberPrimaryPhone(user.mobileNumber, user.mobileAreaCode) ?? null;
      const suspensionUpdate = buildAMemberSuspensionUpdate(user);

      await pool.query(sql`
        insert into ${usersTable} (
          tenant_id,
          id,
          primary_email,
          username,
          primary_phone,
          name,
          profile,
          custom_data,
          is_suspended,
          password_encrypted,
          password_encryption_method,
          password_updated_at
        )
        values (
          ${tenantId},
          ${userId},
          ${identity.email ?? null},
          ${identity.username ?? null},
          ${primaryPhone},
          ${user.name ?? null},
          ${sql.jsonb(buildAMemberUserProfile(user))},
          ${sql.jsonb(buildAMemberCustomData(user))},
          ${suspensionUpdate.isSuspended ?? false},
          ${passwordEncrypted},
          ${passwordEncryptionMethod},
          ${passwordEncrypted ? toTimestampFromMs(Date.now()) : null}
        )
      `);

      await assignDefaultRoles(userId);

      return {
        id: userId,
        primaryEmail: identity.email ?? null,
        username: identity.username ?? null,
        customData: buildAMemberCustomData(user),
        passwordEncrypted,
        passwordEncryptionMethod,
      };
    },
    updateUserFromAMember: async (userId, user) => {
      const identity = resolveAMemberUserIdentity(user);

      if (!identity) {
        return;
      }

      const existing = await pool.maybeOne<{
        customData: Record<string, unknown>;
        profile: Record<string, unknown>;
        isSuspended: boolean;
        passwordEncrypted: string | null;
        passwordEncryptionMethod: string | null;
      }>(sql`
        select
          custom_data as "customData",
          profile,
          is_suspended as "isSuspended",
          password_encrypted as "passwordEncrypted",
          password_encryption_method as "passwordEncryptionMethod"
        from ${usersTable}
        where tenant_id = ${tenantId}
          and id = ${userId}
      `);

      if (existing && wasRecentlyPushedToAMember(existing.customData)) {
        return;
      }

      const importedPassword = syncPasswords ? resolveAMemberPasswordImport(user) : undefined;
      const shouldUpdatePassword = Boolean(
        importedPassword &&
          (importedPassword.passwordEncrypted !== existing?.passwordEncrypted ||
            importedPassword.passwordEncryptionMethod !== existing?.passwordEncryptionMethod)
      );

      const phoneUpdate = buildAMemberPhoneUpdate(user);
      const suspensionUpdate = buildAMemberSuspensionUpdate(user);
      const shouldUpdateSuspension = suspensionUpdate.isSuspended !== undefined;

      await pool.query(sql`
        update ${usersTable}
        set
          primary_email = ${identity.email ?? null},
          username = ${identity.username ?? null},
          primary_phone = case
            when ${phoneUpdate.primaryPhone !== undefined} then ${phoneUpdate.primaryPhone ?? null}
            else primary_phone
          end,
          name = ${user.name ?? null},
          profile = ${sql.jsonb(buildAMemberUserProfile(user, existing?.profile))},
          is_suspended = case
            when ${shouldUpdateSuspension} then ${suspensionUpdate.isSuspended ?? false}
            else is_suspended
          end,
          custom_data = coalesce(custom_data, '{}'::jsonb) || ${sql.jsonb(
            buildAMemberCustomData(user, (existing?.customData ?? {}) as AMemberCustomData)
          )},
          password_encrypted = case
            when ${shouldUpdatePassword} then ${importedPassword?.passwordEncrypted ?? null}
            else password_encrypted
          end,
          password_encryption_method = case
            when ${shouldUpdatePassword} then ${importedPassword?.passwordEncryptionMethod ?? null}
            else password_encryption_method
          end,
          password_updated_at = case
            when ${shouldUpdatePassword} then ${toTimestampFromMs(Date.now())}
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

      const currentProductRoleIds = new Set(
        currentAssignments
          .filter((assignment) => isProductRoleName(assignment.roleName))
          .map((assignment) => assignment.roleId)
      );

      let added = 0;
      let removed = 0;

      for (const roleId of desiredRoleIds) {
        if (!currentProductRoleIds.has(roleId)) {
          await pool.query(sql`
            insert into ${usersRolesTable} (tenant_id, id, user_id, role_id)
            values (${tenantId}, ${generateStandardId()}, ${userId}, ${roleId})
            on conflict do nothing
          `);
          added += 1;
        }
      }

      for (const roleId of currentProductRoleIds) {
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
    deleteLogtoUserFromAMember: async (userId) => {
      await pool.query(sql`
        delete from ${usersTable}
        where tenant_id = ${tenantId}
          and id = ${userId}
      `);
    },
  };
};
