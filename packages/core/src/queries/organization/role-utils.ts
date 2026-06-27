import {
  RoleType,
  type OrganizationRole,
  type OrganizationRoleWithScopes,
} from '@logto/schemas';

/** Ensure role responses satisfy {@link OrganizationRoles.guard} for koa-guard validation. */
export const normalizeOrganizationRole = (role: OrganizationRole): OrganizationRole => ({
  ...role,
  description: role.description ?? null,
  type: role.type ?? RoleType.User,
});

export const normalizeOrganizationRoleWithScopes = (
  role: OrganizationRoleWithScopes
): OrganizationRoleWithScopes => ({
  ...normalizeOrganizationRole(role),
  scopes: role.scopes ?? [],
  resourceScopes: role.resourceScopes ?? [],
});
