import { z } from 'zod';

import type { AMemberSyncStoredConfig } from '@logto/schemas';

import { resolveDatabaseUrl } from './database-connection.js';

export type AMemberProduct = {
  productId: number;
  title: string;
  description?: string;
};

export type AMemberUser = {
  userId: number;
  login: string;
  email?: string;
  /** Legacy phpass/bcrypt value from `am_user.pass` (API sync only). */
  passwordHash?: string;
  /** Unix crypt hash from `am_user.crypt_pass` (database sync). */
  cryptPass?: string;
  /** Value from `am_user.mobile_number`. */
  mobileNumber?: string;
  /** Country calling code from `am_user.mobile_area_code` (e.g. `1`, `61`). */
  mobileAreaCode?: string;
  name?: string;
  birthday?: string;
  pushoverKey?: string;
  subusersParentId?: number;
  pin?: string;
  comment?: string;
  iAgree?: boolean;
  isApproved?: boolean;
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  lang?: string;
  unsubscribed?: boolean;
  status?: number | string;
  isLocked?: boolean;
  isDeleted?: boolean;
  nameF?: string;
  nameL?: string;
};

export type AMemberAccess = {
  userId: number;
  productId: number;
  beginDate?: string;
  expireDate?: string;
};

export const amemberSyncModeGuard = z.enum(['api', 'database']);

export type AMemberSyncMode = z.infer<typeof amemberSyncModeGuard>;

export const amemberRoleSyncModeGuard = z.enum(['one_way', 'two_way']);

export type AMemberRoleSyncMode = z.infer<typeof amemberRoleSyncModeGuard>;

export const amemberSyncConfigGuard = z
  .object({
    enabled: z.literal(true),
    outboundEnabled: z.boolean().default(true),
    roleSyncMode: amemberRoleSyncModeGuard.default('one_way'),
    tenantId: z.string().min(1),
    intervalSeconds: z.number().int().positive(),
    syncPasswords: z.boolean().default(true),
    deleteLogtoUsersWhenRemovedFromAMember: z.boolean().default(false),
    inboundMode: amemberSyncModeGuard,
    tablePrefix: z.string().default('am_'),
    apiUrl: z.string().url().optional(),
    apiKey: z.string().min(1).optional(),
    databaseUrl: z.string().min(1).optional(),
  })
  .superRefine((config, context) => {
    if (config.inboundMode === 'database' && !config.databaseUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'database connection is required when inboundMode is database',
        path: ['databaseHost'],
      });
    }

    if (config.inboundMode === 'api') {
      if (!config.apiUrl) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'apiUrl is required when inboundMode is api',
          path: ['apiUrl'],
        });
      }

      if (!config.apiKey) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'apiKey is required when inboundMode is api',
          path: ['apiKey'],
        });
      }
    }

    if (config.outboundEnabled) {
      if (!config.apiUrl) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'apiUrl is required when outbound sync is enabled',
          path: ['apiUrl'],
        });
      }

      if (!config.apiKey) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'apiKey is required when outbound sync is enabled',
          path: ['apiKey'],
        });
      }
    }
  });

export type AMemberSyncConfig = z.infer<typeof amemberSyncConfigGuard>;

export const amemberOutboundConfigGuard = z.object({
  tenantId: z.string().min(1),
  roleSyncMode: amemberRoleSyncModeGuard.default('one_way'),
  apiUrl: z.string().url(),
  apiKey: z.string().min(1),
});

export type AMemberOutboundConfig = z.infer<typeof amemberOutboundConfigGuard>;

export const resolveInboundMode = (
  stored: Pick<AMemberSyncStoredConfig, 'inboundMode' | 'mode'>
): AMemberSyncMode => stored.inboundMode ?? stored.mode ?? 'database';

export const hasOutboundApiCredentials = <T extends { apiUrl?: string; apiKey?: string }>(
  config: T
): config is T & { apiUrl: string; apiKey: string } => Boolean(config.apiUrl && config.apiKey);

export const isRoleOutboundSyncEnabled = (
  config: Pick<AMemberOutboundConfig, 'roleSyncMode'>
): boolean => config.roleSyncMode === 'two_way';

export const toAMemberOutboundRuntimeConfig = (
  tenantId: string,
  stored: AMemberSyncStoredConfig
): AMemberOutboundConfig | undefined => {
  if (!stored.outboundEnabled) {
    return;
  }

  const parsed = amemberOutboundConfigGuard.safeParse({
    tenantId,
    roleSyncMode: stored.roleSyncMode ?? 'one_way',
    apiUrl: stored.apiUrl,
    apiKey: stored.apiKey,
  });

  if (!parsed.success) {
    return;
  }

  return parsed.data;
};

export const toAMemberSyncRuntimeConfig = (
  tenantId: string,
  stored: AMemberSyncStoredConfig
): AMemberSyncConfig | undefined => {
  if (!stored.enabled) {
    return;
  }

  const inboundMode = resolveInboundMode(stored);

  const parsed = amemberSyncConfigGuard.safeParse({
    enabled: true,
    outboundEnabled: stored.outboundEnabled,
    roleSyncMode: stored.roleSyncMode,
    tenantId,
    intervalSeconds: stored.intervalSeconds,
    syncPasswords: stored.syncPasswords,
    deleteLogtoUsersWhenRemovedFromAMember: stored.deleteLogtoUsersWhenRemovedFromAMember,
    inboundMode,
    tablePrefix: stored.tablePrefix,
    apiUrl: stored.apiUrl,
    apiKey: stored.apiKey,
    databaseUrl: resolveDatabaseUrl(stored),
  });

  if (!parsed.success) {
    return;
  }

  return parsed.data;
};

export type AMemberSyncStats = {
  productsCreated: number;
  productsUpdated: number;
  productsDeleted: number;
  usersCreated: number;
  usersUpdated: number;
  usersSkipped: number;
  usersDeleted: number;
  roleAssignmentsAdded: number;
  roleAssignmentsRemoved: number;
  rolesRevokedDueToInactivity: number;
};

export type AMemberSyncLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};
