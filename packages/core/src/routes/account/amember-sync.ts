import { UserScope } from '@logto/core-kit';
import { amemberUserSyncStatsGuard } from '@logto/schemas';

import RequestError from '#src/errors/RequestError/index.js';
import { runAMemberSyncForLogtoUser } from '#src/libraries/amember-sync/index.js';
import koaGuard from '#src/middleware/koa-guard.js';
import assertThat from '#src/utils/assert-that.js';

import type { RouterInitArgs, UserRouter } from '../types.js';

import { accountApiPrefix } from './constants.js';

export default function accountAMemberSyncRoutes<T extends UserRouter>(
  ...[router, { id: tenantId }]: RouterInitArgs<T>
) {
  router.post(
    `${accountApiPrefix}/amember-sync`,
    koaGuard({
      response: amemberUserSyncStatsGuard,
      status: [200, 401, 404, 503],
    }),
    async (ctx, next) => {
      const { id: userId, scopes } = ctx.auth;

      assertThat(
        scopes.has(UserScope.Roles),
        new RequestError({ code: 'auth.unauthorized', status: 401 })
      );

      ctx.body = await runAMemberSyncForLogtoUser(tenantId, userId);

      return next();
    }
  );
}
