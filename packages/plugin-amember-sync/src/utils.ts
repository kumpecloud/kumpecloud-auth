import {
  isBcryptHash,
  isBcryptHashPrefix,
  isCryptMd5Hash,
  isPhpassHash,
  normalizeBcryptHash,
  PhoneNumberParser,
} from '@logto/shared/universal';

export {
  isBcryptHash,
  isBcryptHashPrefix,
  isCryptMd5Hash,
  isPhpassHash,
  normalizeBcryptHash,
} from '@logto/shared/universal';

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

export type AMemberPasswordImport = {
  passwordEncrypted: string;
  passwordEncryptionMethod: 'Legacy' | 'Bcrypt' | 'MD5';
};

export const buildPhpassLegacyPassword = (hash: string) =>
  JSON.stringify(['phpass', ['@'], hash]);

export const buildCryptMd5LegacyPassword = (hash: string) =>
  JSON.stringify(['crypt-md5', ['@'], hash]);

const mapPassColumnHash = (passwordHash: string | undefined): AMemberPasswordImport | undefined => {
  const hash = passwordHash?.trim();

  if (!hash) {
    return;
  }

  if (isBcryptHash(hash) || isBcryptHashPrefix(hash)) {
    const normalized = normalizeBcryptHash(hash);

    if (!isBcryptHash(normalized)) {
      return;
    }

    return {
      passwordEncrypted: normalized,
      passwordEncryptionMethod: 'Bcrypt',
    };
  }

  if (isPhpassHash(hash)) {
    return {
      passwordEncrypted: buildPhpassLegacyPassword(hash),
      passwordEncryptionMethod: 'Legacy',
    };
  }

  if (isCryptMd5Hash(hash)) {
    return {
      passwordEncrypted: buildCryptMd5LegacyPassword(hash),
      passwordEncryptionMethod: 'Legacy',
    };
  }

  if (/^[a-f0-9]{32}$/iu.test(hash)) {
    return {
      passwordEncrypted: hash.toLowerCase(),
      passwordEncryptionMethod: 'MD5',
    };
  }

  return;
};

/**
 * Map aMember password fields into Logto password storage.
 * Database sync reads `crypt_pass` only; API sync may still provide legacy `pass`.
 */
export const resolveAMemberPasswordImport = (
  user: Pick<AMemberUser, 'passwordHash' | 'cryptPass'>
): AMemberPasswordImport | undefined => {
  const cryptPass = user.cryptPass?.trim();

  if (cryptPass && isCryptMd5Hash(cryptPass)) {
    return {
      passwordEncrypted: buildCryptMd5LegacyPassword(cryptPass),
      passwordEncryptionMethod: 'Legacy',
    };
  }

  return mapPassColumnHash(user.passwordHash);
};

const sanitizePhoneDigits = (phone: string) => phone.replace(/\D/gu, '');

const tryParsePrimaryPhone = (phone: string) => {
  const parser = new PhoneNumberParser(phone);
  const internationalNumber = parser.internationalNumber;

  if (parser.isValid && internationalNumber && internationalNumber.length >= 8) {
    return internationalNumber;
  }

  return;
};

const normalizePhoneInput = (phone: string) => {
  const digits = sanitizePhoneDigits(phone);

  if (digits.length === 10 && !phone.startsWith('+')) {
    const nanp = tryParsePrimaryPhone(`+1${digits}`);

    if (nanp) {
      return nanp;
    }
  }

  if (digits.length === 11 && digits.startsWith('1') && !phone.startsWith('+')) {
    const nanp = tryParsePrimaryPhone(`+${digits}`);

    if (nanp) {
      return nanp;
    }
  }

  const direct = tryParsePrimaryPhone(phone);

  if (direct) {
    return direct;
  }

  if (digits && !phone.startsWith('+')) {
    return tryParsePrimaryPhone(`+${digits}`);
  }

  return;
};

/**
 * Combine aMember `mobile_area_code` and `mobile_number` into a single phone string.
 * When the number already includes a country prefix (`+` or full international digits), the area code is ignored.
 */
export const combineAMemberPhoneFields = (
  mobileNumber?: string,
  mobileAreaCode?: string
): string | undefined => {
  const number = mobileNumber?.trim();

  if (!number) {
    return;
  }

  if (number.startsWith('+')) {
    return number;
  }

  const areaCode = mobileAreaCode?.trim();

  if (areaCode) {
    const areaDigits = sanitizePhoneDigits(areaCode);
    const localDigits = sanitizePhoneDigits(number).replace(/^0+/, '');

    if (!localDigits) {
      return;
    }

    return `+${areaDigits}${localDigits}`;
  }

  return number;
};

/**
 * Normalize aMember phone fields into Logto `primaryPhone` storage format.
 * Accepts common input styles (formatted, digits-only, with/without `+`) and returns
 * the international number string Logto uses (`countryCode` + `nationalNumber`).
 */
export const resolveAMemberPrimaryPhone = (
  mobileNumber?: string,
  mobileAreaCode?: string
): string | undefined => {
  const combined = combineAMemberPhoneFields(mobileNumber, mobileAreaCode);

  if (!combined) {
    return;
  }

  return normalizePhoneInput(combined);
};

export const buildAMemberPhoneUpdate = (
  user: Pick<AMemberUser, 'mobileNumber' | 'mobileAreaCode'>
) => {
  if (user.mobileNumber === undefined && user.mobileAreaCode === undefined) {
    return {};
  }

  if (!user.mobileNumber?.trim() && !user.mobileAreaCode?.trim()) {
    return { primaryPhone: null };
  }

  return {
    primaryPhone: resolveAMemberPrimaryPhone(user.mobileNumber, user.mobileAreaCode) ?? null,
  };
};

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

export const buildAMemberUserName = (nameF?: string, nameL?: string) => {
  const name = [nameF, nameL].filter(Boolean).join(' ').trim();

  return name || undefined;
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
