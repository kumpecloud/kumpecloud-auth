import { RoleType } from '@logto/schemas';

import {
  normalizeOrganizationRole,
  normalizeOrganizationRoleWithScopes,
} from './role-utils.js';

describe('normalizeOrganizationRole', () => {
  it('fills nullable fields expected by OrganizationRoles.guard', () => {
    expect(
      normalizeOrganizationRole({
        tenantId: 'default',
        id: 'role_id',
        name: 'viewer',
      } as never)
    ).toEqual({
      tenantId: 'default',
      id: 'role_id',
      name: 'viewer',
      description: null,
      type: RoleType.User,
    });
  });
});

describe('normalizeOrganizationRoleWithScopes', () => {
  it('normalizes role fields and preserves scope arrays', () => {
    expect(
      normalizeOrganizationRoleWithScopes({
        tenantId: 'default',
        id: 'role_id',
        name: 'viewer',
        scopes: [{ id: 'scope_id', name: 'read' }],
        resourceScopes: [],
      } as never)
    ).toEqual({
      tenantId: 'default',
      id: 'role_id',
      name: 'viewer',
      description: null,
      type: RoleType.User,
      scopes: [{ id: 'scope_id', name: 'read' }],
      resourceScopes: [],
    });
  });
});
