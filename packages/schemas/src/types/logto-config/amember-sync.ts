import { z } from 'zod';

export const amemberSyncModeGuard = z.enum(['api', 'database']);

export const amemberRoleSyncModeGuard = z.enum(['one_way', 'two_way']);

export const amemberSyncStoredConfigGuard = z.object({
  enabled: z.boolean().default(false),
  outboundEnabled: z.boolean().default(true),
  /**
   * `one_way`: aMember access drives Logto product roles; Logto role changes do not push to aMember.
   * `two_way`: manual Logto role grants and revocations also update aMember access.
   */
  roleSyncMode: amemberRoleSyncModeGuard.default('one_way'),
  /** How aMember data is read into Logto (scheduled inbound sync). */
  inboundMode: amemberSyncModeGuard.default('database'),
  /** @deprecated Use `inboundMode`. Kept for backward compatibility when reading stored config. */
  mode: amemberSyncModeGuard.optional(),
  intervalSeconds: z.number().int().positive().default(3600),
  syncPasswords: z.boolean().default(true),
  /** When enabled, inbound sync deletes Logto users whose linked aMember account was removed or marked deleted. */
  deleteLogtoUsersWhenRemovedFromAMember: z.boolean().default(false),
  tablePrefix: z.string().default('am_'),
  apiUrl: z.string().optional(),
  apiKey: z.string().optional(),
  /** @deprecated Prefer discrete database connection fields. Kept for legacy stored configs. */
  databaseUrl: z.string().optional(),
  databaseHost: z.string().optional(),
  databasePort: z.number().int().positive().optional(),
  databaseUser: z.string().optional(),
  databasePassword: z.string().optional(),
  databaseName: z.string().optional(),
});

export type AMemberSyncStoredConfig = z.infer<typeof amemberSyncStoredConfigGuard>;

export const amemberSyncConfigPatchGuard = amemberSyncStoredConfigGuard.partial();

export type AMemberSyncConfigPatch = z.infer<typeof amemberSyncConfigPatchGuard>;

export const amemberSyncConfigResponseGuard = amemberSyncStoredConfigGuard
  .omit({
    apiKey: true,
    databaseUrl: true,
    databasePassword: true,
    mode: true,
  })
  .extend({
    apiKeySet: z.boolean(),
    databasePasswordSet: z.boolean(),
  });

export type AMemberSyncConfigResponse = z.infer<typeof amemberSyncConfigResponseGuard>;
