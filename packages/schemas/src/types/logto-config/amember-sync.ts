import { z } from 'zod';

export const amemberSyncModeGuard = z.enum(['api', 'database']);

export const amemberSyncStoredConfigGuard = z.object({
  enabled: z.boolean().default(false),
  mode: amemberSyncModeGuard.default('api'),
  intervalSeconds: z.number().int().positive().default(3600),
  syncPasswords: z.boolean().default(true),
  tablePrefix: z.string().default('am_'),
  apiUrl: z.string().optional(),
  apiKey: z.string().optional(),
  databaseUrl: z.string().optional(),
});

export type AMemberSyncStoredConfig = z.infer<typeof amemberSyncStoredConfigGuard>;

export const amemberSyncConfigPatchGuard = amemberSyncStoredConfigGuard.partial();

export type AMemberSyncConfigPatch = z.infer<typeof amemberSyncConfigPatchGuard>;

export const amemberSyncConfigResponseGuard = amemberSyncStoredConfigGuard
  .omit({ apiKey: true, databaseUrl: true })
  .extend({
    apiKeySet: z.boolean(),
    databaseUrlSet: z.boolean(),
  });

export type AMemberSyncConfigResponse = z.infer<typeof amemberSyncConfigResponseGuard>;
