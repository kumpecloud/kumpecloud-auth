import { amemberUserSyncStatsGuard } from '@logto/schemas';
import { z } from 'zod';

import { runAMemberSyncForLogtoUser } from '#src/libraries/amember-sync/index.js';
import koaGuard from '#src/middleware/koa-guard.js';

import type { ManagementApiRouter, RouterInitArgs } from '../types.js';

export default function adminUserAMemberSyncRoutes<T extends ManagementApiRouter>(
  ...[router, { id: tenantId, queries }]: RouterInitArgs<T>
) {
  router.post(
    '/users/:userId/amember-sync',
    koaGuard({
      params: z.object({ userId: z.string() }),
      response: amemberUserSyncStatsGuard,
      status: [200, 404, 503],
    }),
    async (ctx, next) => {
      const { userId } = ctx.guard.params;

      await queries.users.findUserById(userId);
      ctx.body = await runAMemberSyncForLogtoUser(tenantId, userId);

      return next();
    }
  );
}
