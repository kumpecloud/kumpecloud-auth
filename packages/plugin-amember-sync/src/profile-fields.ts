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
    customDataKey: 'is_aproved',
    rawKeys: ['is_aproved', 'is_approved', 'isApproved', 'isAproved'],
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
