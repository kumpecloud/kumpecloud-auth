/** Custom data key used to link Logto users back to aMember user IDs. */
export const amemberCustomDataKey = 'amember';

/** @deprecated Use product role name format `{productId}: {title}` instead. */
export const amemberRolePrefix = 'aMember: ';

const productRoleNamePattern = /^(\d+):\s*/u;
const legacyRoleNamePattern = /^aMember:\s*(\d+)$/u;

export const buildProductRoleName = (
  productId: number | string,
  title: string,
  maxLength = 128
): string => {
  const prefix = `${productId}: `;
  const maxTitleLength = Math.max(maxLength - prefix.length, 1);
  const trimmedTitle = title.trim().slice(0, maxTitleLength);

  return `${prefix}${trimmedTitle}`;
};

/** @deprecated Use {@link buildProductRoleName} instead. */
export const buildAMemberRoleName = (productId: number | string, title = '') =>
  title ? buildProductRoleName(productId, title) : `${productId}:`;

export const isProductRoleName = (roleName: string) =>
  productRoleNamePattern.test(roleName) || legacyRoleNamePattern.test(roleName);

/** @deprecated Use {@link isProductRoleName} instead. */
export const isAMemberRoleName = isProductRoleName;

export const parseProductIdFromRoleName = (roleName: string): number | undefined => {
  const productMatch = productRoleNamePattern.exec(roleName);

  if (productMatch) {
    const productId = Number(productMatch[1]);

    return Number.isFinite(productId) ? productId : undefined;
  }

  const legacyMatch = legacyRoleNamePattern.exec(roleName);

  if (legacyMatch) {
    const productId = Number(legacyMatch[1]);

    return Number.isFinite(productId) ? productId : undefined;
  }
};

/** @deprecated Use {@link parseProductIdFromRoleName} instead. */
export const parseAMemberProductIdFromRoleName = parseProductIdFromRoleName;
