/** Prefix for roles synced from aMember products. */
export const amemberRolePrefix = 'aMember: ';

/** Custom data key used to link Logto users back to aMember user IDs. */
export const amemberCustomDataKey = 'amember';

export const buildAMemberRoleName = (productId: number | string) =>
  `${amemberRolePrefix}${productId}`;

export const isAMemberRoleName = (roleName: string) => roleName.startsWith(amemberRolePrefix);

export const parseAMemberProductIdFromRoleName = (roleName: string): number | undefined => {
  if (!isAMemberRoleName(roleName)) {
    return;
  }

  const productId = Number(roleName.slice(amemberRolePrefix.length));

  return Number.isFinite(productId) ? productId : undefined;
};
