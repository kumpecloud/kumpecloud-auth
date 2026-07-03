import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AMemberSyncContext, LogtoUserRecord } from './context.js';
import type { AMemberSyncConfig } from './types.js';

const sourceMocks = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getUsers: vi.fn(),
  getAccessRecords: vi.fn(),
}));

vi.mock('./sources/index.js', () => ({
  createAMemberDataSource: () => ({
    getProducts: sourceMocks.getProducts,
    getUsers: sourceMocks.getUsers,
    getAccessRecords: sourceMocks.getAccessRecords,
  }),
}));

const { runAMemberSync } = await import('./sync.js');

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

const createContext = (): AMemberSyncContext & {
  deleteLogtoUserFromAMember: ReturnType<typeof vi.fn>;
  syncUserAMemberRoles: ReturnType<typeof vi.fn>;
} => ({
  findAMemberRoles: vi.fn().mockResolvedValue([]),
  createAMemberRole: vi.fn(),
  updateAMemberRole: vi.fn(),
  deleteAMemberRole: vi.fn(),
  findUsersIndexed: vi.fn().mockResolvedValue({
    byEmail: new Map<string, LogtoUserRecord>(),
    byUsername: new Map<string, LogtoUserRecord>(),
    byAMemberUserId: new Map<number, LogtoUserRecord>([
      [
        42,
        {
          id: 'logto-42',
          primaryEmail: 'user@example.com',
          username: 'user42',
          customData: { amember: { userId: 42 } },
        },
      ],
    ]),
  }),
  createUserFromAMember: vi.fn(),
  updateUserFromAMember: vi.fn(),
  deleteLogtoUserFromAMember: vi.fn().mockResolvedValue(undefined),
  syncUserAMemberRoles: vi.fn().mockResolvedValue({ added: 0, removed: 1 }),
});

describe('runAMemberSync deleteLogtoUsersWhenRemovedFromAMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sourceMocks.getProducts.mockResolvedValue([]);
    sourceMocks.getAccessRecords.mockResolvedValue([]);
  });

  it('revokes roles but does not delete Logto users when the toggle is off', async () => {
    const context = createContext();
    sourceMocks.getUsers.mockResolvedValue([
      {
        userId: 42,
        login: 'user42',
        email: 'user@example.com',
        isDeleted: true,
      },
    ]);

    const stats = await runAMemberSync({
      config: baseConfig,
      context,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(context.deleteLogtoUserFromAMember).not.toHaveBeenCalled();
    expect(context.syncUserAMemberRoles).toHaveBeenCalledWith('logto-42', [], expect.any(Map));
    expect(stats.usersDeleted).toBe(0);
  });

  it('deletes linked Logto users when aMember marks them deleted and the toggle is on', async () => {
    const context = createContext();
    sourceMocks.getUsers.mockResolvedValue([
      {
        userId: 42,
        login: 'user42',
        email: 'user@example.com',
        isDeleted: true,
      },
    ]);

    const stats = await runAMemberSync({
      config: { ...baseConfig, deleteLogtoUsersWhenRemovedFromAMember: true },
      context,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(context.deleteLogtoUserFromAMember).toHaveBeenCalledWith('logto-42');
    expect(stats.usersDeleted).toBe(1);
  });

  it('deletes linked Logto users when aMember no longer returns them and the toggle is on', async () => {
    const context = createContext();
    sourceMocks.getUsers.mockResolvedValue([]);

    const stats = await runAMemberSync({
      config: { ...baseConfig, deleteLogtoUsersWhenRemovedFromAMember: true },
      context,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(context.deleteLogtoUserFromAMember).toHaveBeenCalledWith('logto-42');
    expect(stats.usersDeleted).toBe(1);
  });

  it('does not create deleted-user or inactive aMember accounts in Logto', async () => {
    const context = createContext();
    sourceMocks.getUsers.mockResolvedValue([
      {
        userId: 99,
        login: 'deleted-user-99',
        email: 'removed@example.com',
      },
      {
        userId: 100,
        login: 'inactive-user',
        email: 'inactive@example.com',
        status: 2,
      },
    ]);

    const stats = await runAMemberSync({
      config: baseConfig,
      context,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(context.createUserFromAMember).not.toHaveBeenCalled();
    expect(context.updateUserFromAMember).not.toHaveBeenCalled();
    expect(stats.usersCreated).toBe(0);
    expect(stats.usersSkipped).toBe(2);
  });

  it('keeps inactive and expired users in Logto when the toggle is on', async () => {
    const context = createContext();
    sourceMocks.getUsers.mockResolvedValue([
      {
        userId: 42,
        login: 'user42',
        email: 'user@example.com',
        status: 2,
      },
      {
        userId: 43,
        login: 'expired-user',
        email: 'expired@example.com',
        status: 'expired',
      },
    ]);
    context.findUsersIndexed.mockResolvedValue({
      byEmail: new Map(),
      byUsername: new Map(),
      byAMemberUserId: new Map([
        [
          42,
          {
            id: 'logto-42',
            primaryEmail: 'user@example.com',
            username: 'user42',
            customData: { amember: { userId: 42 } },
          },
        ],
        [
          43,
          {
            id: 'logto-43',
            primaryEmail: 'expired@example.com',
            username: 'expired-user',
            customData: { amember: { userId: 43 } },
          },
        ],
      ]),
    });

    const stats = await runAMemberSync({
      config: { ...baseConfig, deleteLogtoUsersWhenRemovedFromAMember: true },
      context,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(context.deleteLogtoUserFromAMember).not.toHaveBeenCalled();
    expect(context.syncUserAMemberRoles).toHaveBeenCalledWith('logto-42', [], expect.any(Map));
    expect(context.syncUserAMemberRoles).toHaveBeenCalledWith('logto-43', [], expect.any(Map));
    expect(stats.usersDeleted).toBe(0);
  });

  it('deletes existing Logto users for deleted-user logins when the toggle is on', async () => {
    const context = createContext();
    sourceMocks.getUsers.mockResolvedValue([
      {
        userId: 42,
        login: 'deleted-user-42',
        email: 'user@example.com',
      },
    ]);

    const stats = await runAMemberSync({
      config: { ...baseConfig, deleteLogtoUsersWhenRemovedFromAMember: true },
      context,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(context.createUserFromAMember).not.toHaveBeenCalled();
    expect(context.deleteLogtoUserFromAMember).toHaveBeenCalledWith('logto-42');
    expect(stats.usersDeleted).toBe(1);
  });

  it('keeps pending users without access and suspended users when the toggle is on', async () => {
    const context = createContext();
    context.findUsersIndexed.mockResolvedValue({
      byEmail: new Map(),
      byUsername: new Map(),
      byAMemberUserId: new Map([
        [
          7,
          {
            id: 'logto-7',
            primaryEmail: 'pending@example.com',
            username: 'pending',
            customData: { amember: { userId: 7 } },
          },
        ],
        [
          8,
          {
            id: 'logto-8',
            primaryEmail: 'locked@example.com',
            username: 'locked',
            customData: { amember: { userId: 8 } },
          },
        ],
      ]),
    });
    sourceMocks.getUsers.mockResolvedValue([
      {
        userId: 7,
        login: 'pending',
        email: 'pending@example.com',
        status: 1,
      },
      {
        userId: 8,
        login: 'locked',
        email: 'locked@example.com',
        status: 2,
        isLocked: true,
      },
    ]);

    const stats = await runAMemberSync({
      config: { ...baseConfig, deleteLogtoUsersWhenRemovedFromAMember: true },
      context,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(context.deleteLogtoUserFromAMember).not.toHaveBeenCalled();
    expect(stats.usersDeleted).toBe(0);
  });
});
