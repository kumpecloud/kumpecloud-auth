import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AMemberSyncContext } from './context.js';
import type { AMemberDataSource } from './context.js';
import type { AMemberSyncConfig } from './types.js';

const { AMemberUserNotFoundError, runAMemberSyncForUser } = await import('./sync-user.js');

const baseConfig: AMemberSyncConfig = {
  enabled: true,
  outboundEnabled: false,
  roleSyncMode: 'one_way',
  tenantId: 'default',
  intervalSeconds: 3600,
  syncPasswords: true,
  deleteLogtoUsersWhenRemovedFromAMember: false,
  inboundMode: 'api',
  apiUrl: 'https://billing.example.com/amember/api',
  apiKey: 'test-key',
};

const createSource = (): AMemberDataSource & {
  getUserById: ReturnType<typeof vi.fn>;
  findUserByLoginOrEmail: ReturnType<typeof vi.fn>;
  getAccessRecordsForUser: ReturnType<typeof vi.fn>;
  getProductsByIds: ReturnType<typeof vi.fn>;
} => ({
  getProducts: vi.fn(),
  getUsers: vi.fn(),
  getAccessRecords: vi.fn(),
  getUserById: vi.fn(),
  findUserByLoginOrEmail: vi.fn(),
  getAccessRecordsForUser: vi.fn(),
  getProductsByIds: vi.fn(),
});

const createContext = (): AMemberSyncContext & {
  createAMemberRole: ReturnType<typeof vi.fn>;
  syncUserAMemberRoles: ReturnType<typeof vi.fn>;
} => ({
  findAMemberRoles: vi.fn().mockResolvedValue([]),
  createAMemberRole: vi.fn().mockResolvedValue({
    id: 'role-1',
    name: '10: Example Product',
    description: 'Example Product',
    type: 'User',
  }),
  updateAMemberRole: vi.fn(),
  deleteAMemberRole: vi.fn(),
  findUsersIndexed: vi.fn(),
  createUserFromAMember: vi.fn(),
  updateUserFromAMember: vi.fn(),
  deleteLogtoUserFromAMember: vi.fn(),
  syncUserAMemberRoles: vi.fn().mockResolvedValue({ added: 1, removed: 0 }),
});

describe('runAMemberSyncForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('syncs active access for a linked aMember user', async () => {
    const source = createSource();
    const context = createContext();

    source.getUserById.mockResolvedValue({
      userId: 42,
      login: 'user42',
      email: 'user@example.com',
    });
    source.getAccessRecordsForUser.mockResolvedValue([
      {
        userId: 42,
        productId: 10,
        expireDate: '2037-12-31',
      },
    ]);
    source.getProductsByIds.mockResolvedValue([
      {
        productId: 10,
        title: 'Example Product',
      },
    ]);

    const stats = await runAMemberSyncForUser({
      config: baseConfig,
      context,
      source,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      logtoUser: {
        id: 'logto-42',
        primaryEmail: 'user@example.com',
        username: 'user42',
        customData: { amember: { userId: 42 } },
      },
    });

    expect(stats).toEqual({
      amemberUserId: 42,
      productIds: [10],
      roleAssignmentsAdded: 1,
      roleAssignmentsRemoved: 0,
    });
    expect(context.createAMemberRole).toHaveBeenCalledWith(10, 'Example Product', 'Example Product');
    expect(context.syncUserAMemberRoles).toHaveBeenCalledWith('logto-42', [10], expect.any(Map));
  });

  it('looks up aMember user by email when not linked', async () => {
    const source = createSource();
    const context = createContext();

    source.findUserByLoginOrEmail.mockResolvedValue({
      userId: 7,
      login: 'lookup',
      email: 'lookup@example.com',
    });
    source.getAccessRecordsForUser.mockResolvedValue([]);
    source.getProductsByIds.mockResolvedValue([]);

    const stats = await runAMemberSyncForUser({
      config: baseConfig,
      context,
      source,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      logtoUser: {
        id: 'logto-7',
        primaryEmail: 'lookup@example.com',
        username: 'lookup',
        customData: {},
      },
    });

    expect(stats.amemberUserId).toBe(7);
    expect(source.findUserByLoginOrEmail).toHaveBeenCalledWith({
      login: 'lookup',
      email: 'lookup@example.com',
    });
  });

  it('throws when no aMember user can be resolved', async () => {
    const source = createSource();
    const context = createContext();

    source.findUserByLoginOrEmail.mockResolvedValue(undefined);

    await expect(
      runAMemberSyncForUser({
        config: baseConfig,
        context,
        source,
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        logtoUser: {
          id: 'logto-missing',
          primaryEmail: 'missing@example.com',
          username: 'missing',
          customData: {},
        },
      })
    ).rejects.toBeInstanceOf(AMemberUserNotFoundError);
  });

  it('revokes product roles when the aMember user is inactive', async () => {
    const source = createSource();
    const context = createContext();

    source.getUserById.mockResolvedValue({
      userId: 42,
      login: 'user42',
      email: 'user@example.com',
      isDeleted: true,
    });
    context.syncUserAMemberRoles.mockResolvedValue({ added: 0, removed: 2 });

    const stats = await runAMemberSyncForUser({
      config: baseConfig,
      context,
      source,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      logtoUser: {
        id: 'logto-42',
        primaryEmail: 'user@example.com',
        username: 'user42',
        customData: { amember: { userId: 42 } },
      },
    });

    expect(stats).toEqual({
      amemberUserId: 42,
      productIds: [],
      roleAssignmentsAdded: 0,
      roleAssignmentsRemoved: 2,
    });
    expect(source.getAccessRecordsForUser).not.toHaveBeenCalled();
  });
});
