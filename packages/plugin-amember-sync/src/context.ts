import type { Role } from '@logto/schemas';

import type { AMemberAccess, AMemberProduct, AMemberUser } from './types.js';

export type AMemberDataSource = {
  getProducts: () => Promise<AMemberProduct[]>;
  getUsers: () => Promise<AMemberUser[]>;
  getAccessRecords: () => Promise<AMemberAccess[]>;
};

export type LogtoUserRecord = {
  id: string;
  primaryEmail: string | null;
  username: string | null;
  customData: Record<string, unknown>;
  passwordEncrypted: string | null;
  passwordEncryptionMethod: string | null;
};

export type AMemberSyncContext = {
  findAMemberRoles: () => Promise<readonly Role[]>;
  createAMemberRole: (productId: number, title: string, description: string) => Promise<Role>;
  updateAMemberRole: (
    roleId: string,
    productId: number,
    title: string,
    description: string
  ) => Promise<void>;
  deleteAMemberRole: (roleId: string) => Promise<void>;
  findUsersIndexed: () => Promise<{
    byEmail: Map<string, LogtoUserRecord>;
    byUsername: Map<string, LogtoUserRecord>;
    byAMemberUserId: Map<number, LogtoUserRecord>;
  }>;
  createUserFromAMember: (user: AMemberUser) => Promise<LogtoUserRecord>;
  updateUserFromAMember: (userId: string, user: AMemberUser) => Promise<void>;
  syncUserAMemberRoles: (
    userId: string,
    productIds: number[],
    roleByProductId: Map<number, Role>
  ) => Promise<{ added: number; removed: number }>;
};
