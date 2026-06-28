import type Queries from '#src/tenants/Queries.js';

/**
 * Load whether Gravatar avatars are enabled for the current tenant.
 */
export const getGravatarEnabled = async (
  accountCenters: Queries['accountCenters']
): Promise<boolean> => {
  const { gravatarEnabled } = await accountCenters.findDefaultAccountCenter();

  return gravatarEnabled;
};
