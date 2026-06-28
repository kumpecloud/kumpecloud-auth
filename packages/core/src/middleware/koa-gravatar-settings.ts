import type { MiddlewareType } from 'koa';
import { type IRouterParamContext } from 'koa-router';

import type Queries from '#src/tenants/Queries.js';

import { getGravatarEnabled } from '#src/utils/gravatar-settings.js';

export type WithGravatarSettingsContext<ContextT extends IRouterParamContext = IRouterParamContext> =
  ContextT & {
    gravatarEnabled: boolean;
  };

/**
 * Load tenant Gravatar settings once per request for user profile responses.
 */
export default function koaGravatarSettings<StateT, ContextT extends IRouterParamContext, ResponseT>(
  queries: Queries
): MiddlewareType<StateT, WithGravatarSettingsContext<ContextT>, ResponseT> {
  return async (ctx, next) => {
    ctx.gravatarEnabled = await getGravatarEnabled(queries.accountCenters);

    return next();
  };
}
