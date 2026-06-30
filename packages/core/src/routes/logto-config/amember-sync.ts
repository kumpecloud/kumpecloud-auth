import {
  amemberSyncConfigPatchGuard,
  amemberSyncConfigResponseGuard,
  amemberSyncStoredConfigGuard,
  type AMemberSyncConfigPatch,
  type AMemberSyncConfigResponse,
  type AMemberSyncStoredConfig,
} from '@logto/schemas';
import { resolveInboundMode } from '@logto/plugin-amember-sync';

import koaGuard from '#src/middleware/koa-guard.js';

import type { ManagementApiRouter, RouterInitArgs } from '../types.js';

import { runTenantAMemberSync } from '../../libraries/amember-sync/index.js';

const toResponse = (config: AMemberSyncStoredConfig): AMemberSyncConfigResponse => {
  const { mode: _deprecatedMode, ...rest } = config;

  return amemberSyncConfigResponseGuard.parse({
    ...rest,
    inboundMode: resolveInboundMode(config),
    apiKeySet: Boolean(config.apiKey),
    databaseUrlSet: Boolean(config.databaseUrl),
  });
};

const mergeAMemberSyncConfig = (
  existing: AMemberSyncStoredConfig,
  patch: AMemberSyncConfigPatch
): AMemberSyncStoredConfig => {
  const inboundMode =
    patch.inboundMode ?? patch.mode ?? existing.inboundMode ?? existing.mode ?? 'database';

  const merged = {
    ...existing,
    ...patch,
    inboundMode,
  };

  delete (merged as { mode?: string }).mode;

  if (!patch.apiKey?.trim()) {
    merged.apiKey = existing.apiKey;
  }

  if (!patch.databaseUrl?.trim()) {
    merged.databaseUrl = existing.databaseUrl;
  }

  return amemberSyncStoredConfigGuard.parse(merged);
};

export default function amemberSyncRoutes<T extends ManagementApiRouter>(
  ...[router, tenant]: RouterInitArgs<T>
) {
  const {
    queries: {
      logtoConfigs: { getAMemberSyncConfig, upsertAMemberSyncConfig },
    },
    id: tenantId,
  } = tenant;

  router.get(
    '/configs/amember-sync',
    koaGuard({
      response: amemberSyncConfigResponseGuard,
      status: [200],
    }),
    async (ctx, next) => {
      const config =
        (await getAMemberSyncConfig()) ?? amemberSyncStoredConfigGuard.parse({ enabled: false });

      ctx.body = toResponse(config);
      return next();
    }
  );

  router.patch(
    '/configs/amember-sync',
    koaGuard({
      body: amemberSyncConfigPatchGuard,
      response: amemberSyncConfigResponseGuard,
      status: [200],
    }),
    async (ctx, next) => {
      const existing =
        (await getAMemberSyncConfig()) ?? amemberSyncStoredConfigGuard.parse({ enabled: false });
      const updated = await upsertAMemberSyncConfig(mergeAMemberSyncConfig(existing, ctx.guard.body));

      ctx.body = toResponse(updated);
      return next();
    }
  );

  router.post(
    '/configs/amember-sync/run',
    koaGuard({
      status: [204],
    }),
    async (ctx, next) => {
      await runTenantAMemberSync(tenantId);
      ctx.status = 204;
      return next();
    }
  );
}
