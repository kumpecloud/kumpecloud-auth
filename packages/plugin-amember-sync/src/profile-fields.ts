import type { UserProfile } from '@logto/schemas';
import type { SerializableValue } from '@silverhand/slonik';

import type { AMemberUser } from './types.js';
import { isTruthyFlag, normalizeAMemberDateString } from './utils.js';

type SerializableJsonObject = {
  [key: string]: SerializableValue | undefined;
};

export type AMemberCustomData = SerializableJsonObject;

type AMemberProfileFieldKind = 'string' | 'boolean' | 'number' | 'date' | 'status';

type AMemberProfileFieldDescriptor = {
  userKey: keyof AMemberUser;
  customDataKey: string;
  rawKeys: readonly string[];
  kind: AMemberProfileFieldKind;
};

export const aMemberProfileFieldDescriptors = [
  {
    userKey: 'birthday',
    customDataKey: 'birthday',
    rawKeys: ['birthday'],
    kind: 'date',
  },
  {
    userKey: 'pushoverKey',
    customDataKey: 'pushover_key',
    rawKeys: ['pushover_key', 'pushoverKey'],
    kind: 'string',
  },
  {
    userKey: 'subusersParentId',
    customDataKey: 'subusers_parent_id',
    rawKeys: ['subusers_parent_id', 'subusersParentId'],
    kind: 'number',
  },
  {
    userKey: 'pin',
    customDataKey: 'pin',
    rawKeys: ['pin'],
    kind: 'string',
  },
  {
    userKey: 'comment',
    customDataKey: 'comment',
    rawKeys: ['comment'],
    kind: 'string',
  },
  {
    userKey: 'iAgree',
    customDataKey: 'i_agree',
    rawKeys: ['i_agree', 'iAgree'],
    kind: 'boolean',
  },
  {
    userKey: 'isApproved',
    customDataKey: 'is_approved',
    rawKeys: ['is_approved', 'is_aproved', 'isApproved', 'isAproved'],
    kind: 'boolean',
  },
  {
    userKey: 'isLocked',
    customDataKey: 'is_locked',
    rawKeys: ['is_locked', 'isLocked'],
    kind: 'boolean',
  },
  {
    userKey: 'unsubscribed',
    customDataKey: 'unsubscribed',
    rawKeys: ['unsubscribed'],
    kind: 'boolean',
  },
  {
    userKey: 'status',
    customDataKey: 'status',
    rawKeys: ['status'],
    kind: 'status',
  },
  {
    userKey: 'nameF',
    customDataKey: 'name_f',
    rawKeys: ['name_f', 'nameF'],
    kind: 'string',
  },
  {
    userKey: 'nameL',
    customDataKey: 'name_l',
    rawKeys: ['name_l', 'nameL'],
    kind: 'string',
  },
  {
    userKey: 'street',
    customDataKey: 'street',
    rawKeys: ['street'],
    kind: 'string',
  },
  {
    userKey: 'street2',
    customDataKey: 'street2',
    rawKeys: ['street2'],
    kind: 'string',
  },
  {
    userKey: 'city',
    customDataKey: 'city',
    rawKeys: ['city'],
    kind: 'string',
  },
  {
    userKey: 'state',
    customDataKey: 'state',
    rawKeys: ['state'],
    kind: 'string',
  },
  {
    userKey: 'zip',
    customDataKey: 'zip',
    rawKeys: ['zip'],
    kind: 'string',
  },
  {
    userKey: 'country',
    customDataKey: 'country',
    rawKeys: ['country'],
    kind: 'string',
  },
  {
    userKey: 'lang',
    customDataKey: 'lang',
    rawKeys: ['lang'],
    kind: 'string',
  },
] as const satisfies readonly AMemberProfileFieldDescriptor[];

export const amemberUserBaseColumns = [
  'user_id',
  'login',
  'email',
  'crypt_pass',
  'mobile_area_code',
  'mobile_number',
] as const;

/** Pick user-table columns that exist in the connected aMember database. */
export const resolveDatabaseUserSelectColumns = (availableColumns: ReadonlySet<string>) => {
  const missingBase = amemberUserBaseColumns.filter((column) => !availableColumns.has(column));

  if (missingBase.length > 0) {
    throw new Error(`Missing required aMember user columns: ${missingBase.join(', ')}`);
  }

  const columns: string[] = [...amemberUserBaseColumns];

  for (const descriptor of aMemberProfileFieldDescriptors) {
    const column = descriptor.rawKeys.find((key) => availableColumns.has(key));

    if (column) {
      columns.push(column);
    }
  }

  return columns;
};

export type AMemberSyncedProfileUser = Pick<
  AMemberUser,
  (typeof aMemberProfileFieldDescriptors)[number]['userKey']
>;

const toOptionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return;
  }

  const trimmed = String(value).trim();

  return trimmed || undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') {
    return;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
};

const toOptionalBoolean = (value: unknown): boolean | undefined => {
  if (value === null || value === undefined || value === '') {
    return;
  }

  return isTruthyFlag(value);
};

const pickRawValue = (raw: Record<string, unknown>, keys: readonly string[]) => {
  for (const key of keys) {
    if (raw[key] !== undefined) {
      return raw[key];
    }
  }

  return;
};

const parseProfileFieldValue = (
  raw: Record<string, unknown>,
  descriptor: AMemberProfileFieldDescriptor
) => {
  const value = pickRawValue(raw, descriptor.rawKeys);

  switch (descriptor.kind) {
    case 'date': {
      return normalizeAMemberDateString(value);
    }
    case 'string': {
      return toOptionalString(value);
    }
    case 'number': {
      return toOptionalNumber(value);
    }
    case 'boolean': {
      return toOptionalBoolean(value);
    }
    case 'status': {
      if (value === undefined || value === null || value === '') {
        return;
      }

      return toOptionalNumber(value) ?? toOptionalString(value);
    }
  }
};

/** Map aMember user row/API payload fields into {@link AMemberUser} profile properties. */
export const parseAMemberUserProfileFields = (
  raw: Record<string, unknown>
): AMemberSyncedProfileUser =>
  Object.fromEntries(
    aMemberProfileFieldDescriptors.map((descriptor) => [
      descriptor.userKey,
      parseProfileFieldValue(raw, descriptor),
    ])
  ) as AMemberSyncedProfileUser;

const assignCustomDataValue = (
  target: SerializableJsonObject,
  descriptor: AMemberProfileFieldDescriptor,
  value: unknown
) => {
  if (value === undefined) {
    return;
  }

  if (descriptor.kind === 'string' || descriptor.kind === 'date') {
    if (typeof value === 'string' && value) {
      target[descriptor.customDataKey] = value;
    }

    return;
  }

  if (descriptor.kind === 'boolean' && typeof value === 'boolean') {
    target[descriptor.customDataKey] = value;
    return;
  }

  if (descriptor.kind === 'number' && typeof value === 'number') {
    target[descriptor.customDataKey] = value;
    return;
  }

  if (descriptor.kind === 'status') {
    if (typeof value === 'number') {
      target[descriptor.customDataKey] = value;
      return;
    }

    if (typeof value === 'string' && value) {
      target[descriptor.customDataKey] = value;
    }
  }
};

/** Build the sync-managed `customData.amember` payload using aMember column names. */
export const buildAMemberSyncedCustomDataFields = (user: AMemberUser): SerializableJsonObject => {
  const amember: SerializableJsonObject = {
    userId: user.userId,
  };

  for (const descriptor of aMemberProfileFieldDescriptors) {
    assignCustomDataValue(amember, descriptor, user[descriptor.userKey]);
  }

  return amember;
};

export const buildAMemberCustomData = (
  user: AMemberUser,
  existing?: SerializableJsonObject
): SerializableJsonObject => ({
  ...existing,
  amember: buildAMemberSyncedCustomDataFields(user),
});

const buildStreetAddress = (street?: string, street2?: string) => {
  const parts = [street, street2].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : undefined;
};

const buildFormattedAddress = (address: NonNullable<UserProfile['address']>) => {
  const { streetAddress, locality, region, postalCode, country } = address;
  const cityLine = [locality, region, postalCode].filter(Boolean).join(', ');
  const parts = [streetAddress, cityLine, country].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : undefined;
};

/** Map aMember profile columns into Logto standard `UserProfile` fields. */
const buildAMemberSyncedUserProfile = (user: AMemberUser): UserProfile => {
  const streetAddress = buildStreetAddress(user.street, user.street2);
  const address: NonNullable<UserProfile['address']> = {};

  const profile: UserProfile = {};

  if (streetAddress) {
    address.streetAddress = streetAddress;
  }

  if (user.city) {
    address.locality = user.city;
  }

  if (user.state) {
    address.region = user.state;
  }

  if (user.zip) {
    address.postalCode = user.zip;
  }

  if (user.country) {
    address.country = user.country;
  }

  if (Object.keys(address).length > 0) {
    address.formatted = buildFormattedAddress(address);
    profile.address = address;
  }

  if (user.nameF) {
    profile.givenName = user.nameF;
  }

  if (user.nameL) {
    profile.familyName = user.nameL;
  }

  if (user.birthday) {
    profile.birthdate = user.birthday;
  }

  if (user.lang) {
    profile.locale = user.lang;
  }

  return profile;
};

/** Build the sync-managed `profile` payload, preserving unrelated existing profile fields. */
export const buildAMemberUserProfile = (
  user: AMemberUser,
  existing?: UserProfile
): UserProfile => {
  const synced = buildAMemberSyncedUserProfile(user);

  if (!existing) {
    return synced;
  }

  const mergedAddress =
    synced.address || existing.address
      ? {
          ...existing.address,
          ...synced.address,
        }
      : undefined;

  if (mergedAddress && Object.keys(mergedAddress).length > 0) {
    mergedAddress.formatted = buildFormattedAddress(mergedAddress);
  }

  return {
    ...existing,
    ...synced,
    ...(mergedAddress && { address: mergedAddress }),
  };
};

export type LogtoUserForAMemberOutbound = {
  username?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  name?: string | null;
  profile?: import('@logto/schemas').UserProfile;
  customData?: Record<string, unknown>;
};

const splitStreetAddress = (streetAddress?: string) => {
  if (!streetAddress) {
    return { street: undefined, street2: undefined };
  }

  const [street, ...rest] = streetAddress.split(',').map((part) => part.trim());

  return {
    street,
    street2: rest.length > 0 ? rest.join(', ') : undefined,
  };
};

/** Map a Logto user record into aMember REST API user fields. */
export const buildLogtoUserToAMemberFields = (
  user: LogtoUserForAMemberOutbound,
  { plainPassword }: { plainPassword?: string } = {}
): Record<string, string> => {
  const amember = user.customData?.amember;

  const amemberData =
    amember && typeof amember === 'object' ? (amember as Record<string, unknown>) : {};

  const login =
    user.username?.trim() ||
    user.primaryEmail?.trim() ||
    (typeof amemberData.login === 'string' ? amemberData.login : undefined);

  if (!login) {
    throw new Error('Cannot push user to aMember without login, username, or email');
  }

  const email = user.primaryEmail?.trim();

  if (!email) {
    throw new Error('Cannot push user to aMember without email');
  }

  const fields: Record<string, string> = {
    login,
    email,
  };

  if (plainPassword) {
    fields.pass = plainPassword;
  }

  const profile = user.profile ?? {};
  const givenName = profile.givenName ?? (typeof amemberData.name_f === 'string' ? amemberData.name_f : undefined);
  const familyName = profile.familyName ?? (typeof amemberData.name_l === 'string' ? amemberData.name_l : undefined);

  if (givenName) {
    fields.name_f = givenName;
  }

  if (familyName) {
    fields.name_l = familyName;
  }

  if (profile.birthdate) {
    fields.birthday = profile.birthdate;
  }

  if (profile.locale) {
    fields.lang = profile.locale;
  }

  const address = profile.address;

  if (address) {
    const { street, street2 } = splitStreetAddress(address.streetAddress);

    if (street) {
      fields.street = street;
    }

    if (street2) {
      fields.street2 = street2;
    }

    if (address.locality) {
      fields.city = address.locality;
    }

    if (address.region) {
      fields.state = address.region;
    }

    if (address.postalCode) {
      fields.zip = address.postalCode;
    }

    if (address.country) {
      fields.country = address.country;
    }
  }

  for (const descriptor of aMemberProfileFieldDescriptors) {
    const value = amemberData[descriptor.customDataKey];

    if (value === undefined || value === null) {
      continue;
    }

    if (descriptor.kind === 'boolean') {
      fields[descriptor.customDataKey] = value ? '1' : '0';
      continue;
    }

    fields[descriptor.customDataKey] = String(value);
  }

  return fields;
};

export const markLogtoGrantedProduct = (
  customData: Record<string, unknown>,
  productId: number
): Record<string, unknown> => {
  const amember =
    customData.amember && typeof customData.amember === 'object'
      ? { ...(customData.amember as Record<string, unknown>) }
      : {};

  const existing = Array.isArray(amember.logtoGrantedProducts)
    ? (amember.logtoGrantedProducts as number[])
    : [];

  if (existing.includes(productId)) {
    return customData;
  }

  return {
    ...customData,
    amember: {
      ...amember,
      logtoGrantedProducts: [...existing, productId],
    },
  };
};

export const unmarkLogtoGrantedProduct = (
  customData: Record<string, unknown>,
  productId: number
): Record<string, unknown> => {
  const amember =
    customData.amember && typeof customData.amember === 'object'
      ? { ...(customData.amember as Record<string, unknown>) }
      : {};

  const existing = Array.isArray(amember.logtoGrantedProducts)
    ? (amember.logtoGrantedProducts as number[])
    : [];

  return {
    ...customData,
    amember: {
      ...amember,
      logtoGrantedProducts: existing.filter((id) => id !== productId),
    },
  };
};

export const setAMemberLinkage = (
  customData: Record<string, unknown>,
  userId: number
): Record<string, unknown> => {
  const amember =
    customData.amember && typeof customData.amember === 'object'
      ? { ...(customData.amember as Record<string, unknown>) }
      : {};

  return {
    ...customData,
    amember: {
      ...amember,
      userId,
      lastOutboundPushAt: Date.now(),
    },
  };
};

export const touchAMemberOutboundPush = (customData: Record<string, unknown>): Record<string, unknown> => {
  const amember =
    customData.amember && typeof customData.amember === 'object'
      ? { ...(customData.amember as Record<string, unknown>) }
      : {};

  return {
    ...customData,
    amember: {
      ...amember,
      lastOutboundPushAt: Date.now(),
    },
  };
};

export const wasRecentlyPushedToAMember = (
  customData: Record<string, unknown>,
  withinMs = 120_000
): boolean => {
  const amember = customData.amember;

  if (!amember || typeof amember !== 'object') {
    return false;
  }

  const lastOutboundPushAt = (amember as { lastOutboundPushAt?: unknown }).lastOutboundPushAt;
  const parsed = Number(lastOutboundPushAt);
  const delta = Date.now() - parsed;

  return Number.isFinite(parsed) && delta >= 0 && delta < withinMs;
};
