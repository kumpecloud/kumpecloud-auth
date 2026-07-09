/** Centralized JSON path constants for MariaDB/Postgres SQL helpers. */
export const oidcPayloadJsonPaths = {
  authorizations: '$.authorizations',
  /** JSON_SEARCH path for grantId anywhere under authorizations. */
  grantIdSearch: '$**.grantId',
} as const;

export const userIdentitiesJsonPaths = {
  root: '$',
  userId: (identityKey: string) => `$.${identityKey}.userId`,
  identityKey: (identityKey: string) => `$.${identityKey}`,
} as const;
