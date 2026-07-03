import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AMemberDataSink } from './sinks/api-sink.js';
import type { AMemberOutboundConfig } from './types.js';

const config: AMemberOutboundConfig = {
  apiUrl: 'https://billing.example.com/amember/api',
  apiKey: 'test-api-key',
  roleOutboundSyncEnabled: false,
};

const sinkMocks = vi.hoisted(() => ({
  findUserByLoginOrEmail: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  grantLifetimeAccess: vi.fn(),
  revokeProductAccess: vi.fn(),
}));

vi.mock('./sinks/api-sink.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./sinks/api-sink.js')>();

  return {
    ...original,
    createApiAMemberDataSink: () =>
      ({
        findUserByLoginOrEmail: sinkMocks.findUserByLoginOrEmail,
        createUser: sinkMocks.createUser,
        updateUser: sinkMocks.updateUser,
        grantLifetimeAccess: sinkMocks.grantLifetimeAccess,
        revokeProductAccess: sinkMocks.revokeProductAccess,
      }) satisfies AMemberDataSink,
  };
});

const { pushLogtoUserToAMember } = await import('./outbound.js');

const createUser = () => ({
  id: 'logto-user-1',
  username: 'jane',
  primaryEmail: 'jane@example.com',
  customData: {} as Record<string, unknown>,
});

describe('pushLogtoUserToAMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('links to an existing aMember user instead of creating a duplicate', async () => {
    const user = createUser();
    sinkMocks.findUserByLoginOrEmail.mockResolvedValue(88);
    const updateUserCustomData = vi.fn().mockResolvedValue(undefined);

    await pushLogtoUserToAMember({
      config,
      context: { updateUserCustomData },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      user,
      plainPassword: 'secret',
    });

    expect(sinkMocks.createUser).not.toHaveBeenCalled();
    expect(updateUserCustomData).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({
        amember: expect.objectContaining({ userId: 88 }),
      })
    );
  });

  it('deduplicates concurrent provisioning for the same Logto user', async () => {
    const user = createUser();
    let resolveCreate!: (value: number) => void;
    const createDeferred = new Promise<number>((resolve) => {
      resolveCreate = resolve;
    });

    sinkMocks.findUserByLoginOrEmail.mockResolvedValue(undefined);
    sinkMocks.createUser.mockReturnValue(createDeferred);
    const updateUserCustomData = vi.fn().mockResolvedValue(undefined);

    const context = {
      config,
      context: { updateUserCustomData },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      user,
      plainPassword: 'secret',
    };

    const first = pushLogtoUserToAMember(context);
    const second = pushLogtoUserToAMember(context);

    resolveCreate(99);

    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
    expect(sinkMocks.createUser).toHaveBeenCalledTimes(1);
  });
});
