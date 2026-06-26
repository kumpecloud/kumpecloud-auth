import type { AMemberAccess, AMemberProduct, AMemberUser } from './types.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export const resolveAMemberUserEmail = (user: AMemberUser): string | undefined => {
  const email = user.email?.trim();

  if (email && emailPattern.test(email)) {
    return email.toLowerCase();
  }

  const login = user.login.trim();

  if (emailPattern.test(login)) {
    return login.toLowerCase();
  }

  return;
};

export type AMemberUserIdentity = {
  email?: string;
  username?: string;
};

/**
 * Resolve how an aMember user maps into Logto identifiers.
 * Most aMember installs use a non-email `login` (username) with an optional separate email field.
 */
export const resolveAMemberUserIdentity = (user: AMemberUser): AMemberUserIdentity | undefined => {
  const login = user.login.trim();

  if (!login) {
    return;
  }

  const email = resolveAMemberUserEmail(user);

  if (email) {
    return {
      email,
      username: email === login.toLowerCase() ? undefined : login,
    };
  }

  return { username: login };
};

export const normalizeBcryptHash = (hash: string) => hash.replace(/^\$2y\$/u, '$2a$');

export const truncateRoleDescription = (value: string, maxLength = 128) =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;

export const normalizeAMemberDateString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString().slice(0, 10);
  }

  const stringValue = String(value).trim();

  if (!stringValue) {
    return;
  }

  if (stringValue.startsWith('0000-00-00')) {
    return '0000-00-00';
  }

  return /^(\d{4}-\d{2}-\d{2})/u.exec(stringValue)?.[1];
};

const parseAMemberDateStart = (value?: string) => {
  const normalized = normalizeAMemberDateString(value);

  if (!normalized || normalized === '0000-00-00') {
    return;
  }

  const beginsAt = new Date(`${normalized}T00:00:00.000Z`);

  return Number.isNaN(beginsAt.getTime()) ? undefined : beginsAt;
};

const parseAMemberDateEnd = (value?: string) => {
  const normalized = normalizeAMemberDateString(value);

  if (!normalized || normalized === '0000-00-00') {
    return;
  }

  const expiresAt = new Date(`${normalized}T23:59:59.999Z`);

  return Number.isNaN(expiresAt.getTime()) ? undefined : expiresAt;
};

export const isAccessActive = (access: AMemberAccess, now = new Date()) => {
  const beginsAt = parseAMemberDateStart(access.beginDate);

  if (beginsAt && beginsAt > now) {
    return false;
  }

  const normalizedExpire = normalizeAMemberDateString(access.expireDate);

  if (!normalizedExpire || normalizedExpire === '0000-00-00') {
    return true;
  }

  const expiresAt = parseAMemberDateEnd(normalizedExpire);

  if (!expiresAt) {
    return false;
  }

  return expiresAt >= now;
};

export const groupActiveAccessByUserId = (accessRecords: AMemberAccess[]) => {
  const accessByUserId = new Map<number, Set<number>>();

  for (const access of accessRecords) {
    if (!isAccessActive(access)) {
      continue;
    }

    const productIds = accessByUserId.get(access.userId) ?? new Set<number>();
    productIds.add(access.productId);
    accessByUserId.set(access.userId, productIds);
  }

  return accessByUserId;
};

export const indexProductsById = (products: AMemberProduct[]) =>
  new Map(products.map((product) => [product.productId, product]));

export const getAMemberUserIdFromCustomData = (
  customData: Record<string, unknown>
): number | undefined => {
  const amember = customData.amember;

  if (!amember || typeof amember !== 'object') {
    return;
  }

  const userId = (amember as { userId?: unknown }).userId;
  const parsed = Number(userId);

  return Number.isFinite(parsed) ? parsed : undefined;
};

export const buildAMemberCustomData = (
  userId: number,
  existing?: Record<string, unknown>
) => {
  const existingAMember =
    existing?.amember && typeof existing.amember === 'object'
      ? (existing.amember as Record<string, unknown>)
      : {};

  return {
    ...existing,
    amember: {
      ...existingAMember,
      userId,
    },
  };
};

export const isTruthyFlag = (value: unknown) => {
  if (value === true || value === 1) {
    return true;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }

  return false;
};

export const isAMemberUserActive = (user: {
  status?: number | string;
  isLocked?: boolean;
  isDeleted?: boolean;
}) => {
  if (user.isDeleted || user.isLocked) {
    return false;
  }

  if (user.status === undefined || user.status === null || user.status === '') {
    return true;
  }

  const normalized = String(user.status).trim().toLowerCase();

  if (['0', '1', 'active', 'pending', 'approved'].includes(normalized)) {
    return true;
  }

  if (['2', 'inactive', 'expired', 'disabled'].includes(normalized)) {
    return false;
  }

  return true;
};
