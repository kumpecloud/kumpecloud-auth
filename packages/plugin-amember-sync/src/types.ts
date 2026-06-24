import { z } from 'zod';

import type { AMemberSyncStoredConfig } from '@logto/schemas';

export type AMemberProduct = {
  productId: number;
  title: string;
  description?: string;
};

export type AMemberUser = {
  userId: number;
  login: string;
  email?: string;
  passwordHash?: string;
  name?: string;
  status?: number | string;
  isLocked?: boolean;
  isDeleted?: boolean;
};

export type AMemberAccess = {
  userId: number;
  productId: number;
  beginDate?: string;
  expireDate?: string;
};

export const amemberSyncModeGuard = z.enum(['api', 'database']);

export type AMemberSyncMode = z.infer<typeof amemberSyncModeGuard>;

const apiConfigGuard = z.object({
  mode: z.literal('api'),
  apiUrl: z.string().url(),
  apiKey: z.string().min(1),
});

const databaseConfigGuard = z.object({
  mode: z.literal('database'),
  databaseUrl: z.string().min(1),
  tablePrefix: z.string().default('am_'),
});

export const amemberSyncConfigGuard = z
  .object({
    enabled: z.boolean(),
    tenantId: z.string().min(1),
    intervalSeconds: z.number().int().positive(),
    syncPasswords: z.boolean().default(true),
  })
  .and(z.discriminatedUnion('mode', [apiConfigGuard, databaseConfigGuard]));

export type AMemberSyncConfig = z.infer<typeof amemberSyncConfigGuard>;

export const toAMemberSyncRuntimeConfig = (
  tenantId: string,
  stored: AMemberSyncStoredConfig
): AMemberSyncConfig | undefined => {
  if (!stored.enabled) {
    return;
  }

  const base = {
    enabled: true as const,
    tenantId,
    intervalSeconds: stored.intervalSeconds,
    syncPasswords: stored.syncPasswords,
  };

  if (stored.mode === 'database') {
    if (!stored.databaseUrl) {
      return;
    }

    return {
      ...base,
      mode: 'database',
      databaseUrl: stored.databaseUrl,
      tablePrefix: stored.tablePrefix,
    };
  }

  if (!stored.apiUrl || !stored.apiKey) {
    return;
  }

  return {
    ...base,
    mode: 'api',
    apiUrl: stored.apiUrl,
    apiKey: stored.apiKey,
  };
};

export type AMemberSyncStats = {
  productsCreated: number;
  productsUpdated: number;
  productsDeleted: number;
  usersCreated: number;
  usersUpdated: number;
  usersSkipped: number;
  roleAssignmentsAdded: number;
  roleAssignmentsRemoved: number;
  rolesRevokedDueToInactivity: number;
};

export type AMemberSyncLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};
