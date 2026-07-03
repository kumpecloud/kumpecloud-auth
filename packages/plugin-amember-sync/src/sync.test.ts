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

  it('deletes linked Logto users when aMember marks them inactive and the toggle is on', async () => {
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
});
