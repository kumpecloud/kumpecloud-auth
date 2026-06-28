import type Router from 'koa-router';

import type { WithAuthContext } from '#src/middleware/koa-auth/index.js';
import type { WithGravatarSettingsContext } from '#src/middleware/koa-gravatar-settings.js';
import { type WithI18nContext } from '../middleware/koa-i18next.js';

export type AuthedMeRouter = Router<unknown, WithAuthContext & WithI18nContext & WithGravatarSettingsContext>;
