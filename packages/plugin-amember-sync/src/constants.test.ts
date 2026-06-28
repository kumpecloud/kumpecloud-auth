import { describe, expect, it } from 'vitest';

import {
  buildAMemberRoleName,
  isAMemberRoleName,
  parseAMemberProductIdFromRoleName,
} from './constants.js';
import { buildAMemberCustomData } from './profile-fields.js';
import {
  isAccessActive,
  isAMemberUserActive,
  normalizeAMemberDateString,
  resolveAMemberPasswordImport,
  resolveAMemberPrimaryPhone,
  resolveAMemberUserEmail,
  resolveAMemberUserIdentity,
} from './utils.js';

describe('aMember role naming', () => {
  it('builds and parses product role names', () => {
    expect(buildAMemberRoleName(42)).toBe('aMember: 42');
    expect(isAMemberRoleName('aMember: 42')).toBe(true);
    expect(isAMemberRoleName('admin')).toBe(false);
    expect(parseAMemberProductIdFromRoleName('aMember: 42')).toBe(42);
  });
});

describe('aMember user helpers', () => {
  it('prefers email and falls back to login', () => {
    expect(resolveAMemberUserEmail({ userId: 1, login: 'user', email: 'User@Example.com' })).toBe(
      'user@example.com'
    );
    expect(resolveAMemberUserEmail({ userId: 1, login: 'user@example.com' })).toBe(
      'user@example.com'
    );
    expect(resolveAMemberUserEmail({ userId: 1, login: 'username-only' })).toBeUndefined();
  });

  it('maps username-only logins into Logto usernames', () => {
    expect(resolveAMemberUserIdentity({ userId: 1, login: 'username-only' })).toEqual({
      username: 'username-only',
    });
    expect(
      resolveAMemberUserIdentity({
        userId: 1,
        login: 'member',
        email: 'member@example.com',
      })
    ).toEqual({
      email: 'member@example.com',
      username: 'member',
    });
  });
});

describe('aMember access helpers', () => {
  it('treats missing or lifetime expiry as active', () => {
    expect(isAccessActive({ userId: 1, productId: 1 })).toBe(true);
    expect(isAccessActive({ userId: 1, productId: 1, expireDate: '0000-00-00' })).toBe(true);
  });

  it('expires access in the past', () => {
    expect(
      isAccessActive(
        { userId: 1, productId: 1, expireDate: '2000-01-01' },
        new Date('2020-01-01T00:00:00.000Z')
      )
    ).toBe(false);
  });

  it('normalizes mysql date objects and datetime strings', () => {
    expect(normalizeAMemberDateString(new Date('2020-01-15T00:00:00.000Z'))).toBe('2020-01-15');
    expect(normalizeAMemberDateString('2020-01-15 00:00:00')).toBe('2020-01-15');

    expect(
      isAccessActive(
        { userId: 1, productId: 1, expireDate: '2020-01-15 00:00:00' },
        new Date('2020-01-16T00:00:00.000Z')
      )
    ).toBe(false);
  });

  it('treats future begin dates as inactive', () => {
    expect(
      isAccessActive(
        { userId: 1, productId: 1, beginDate: '2099-01-01', expireDate: '2099-12-31' },
        new Date('2020-01-01T00:00:00.000Z')
      )
    ).toBe(false);
  });
});

describe('aMember custom data import', () => {
  it('stores profile fields under customData.amember using aMember column names', () => {
    expect(
      buildAMemberCustomData({
        userId: 42,
        login: 'member',
        birthday: '1990-05-01',
        pushoverKey: 'push-key',
        subusersParentId: 7,
        pin: '1234',
        comment: 'VIP member',
        iAgree: true,
        isApproved: false,
        isLocked: false,
        unsubscribed: true,
        status: 1,
        nameF: 'Jane',
        nameL: 'Doe',
        street: '123 Main St',
        street2: 'Apt 4',
        city: 'Portland',
        state: 'OR',
        zip: '97201',
        country: 'US',
        lang: 'en',
      })
    ).toEqual({
      amember: {
        userId: 42,
        birthday: '1990-05-01',
        pushover_key: 'push-key',
        subusers_parent_id: 7,
        pin: '1234',
        comment: 'VIP member',
        i_agree: true,
        is_approved: false,
        is_locked: false,
        unsubscribed: true,
        status: 1,
        name_f: 'Jane',
        name_l: 'Doe',
        street: '123 Main St',
        street2: 'Apt 4',
        city: 'Portland',
        state: 'OR',
        zip: '97201',
        country: 'US',
        lang: 'en',
      },
    });
  });

  it('preserves non-amember custom data keys on update', () => {
    expect(
      buildAMemberCustomData(
        {
          userId: 42,
          login: 'member',
          nameF: 'Jane',
        },
        { otherApp: { foo: 'bar' }, amember: { userId: 1, comment: 'old' } }
      )
    ).toEqual({
      otherApp: { foo: 'bar' },
      amember: {
        userId: 42,
        name_f: 'Jane',
      },
    });
  });
});

describe('aMember phone import', () => {
  it('normalizes common phone formats to Logto storage format', () => {
    expect(resolveAMemberPrimaryPhone('+1 (650) 253-0000')).toBe('16502530000');
    expect(resolveAMemberPrimaryPhone('6502530000')).toBe('16502530000');
    expect(resolveAMemberPrimaryPhone('16502530000')).toBe('16502530000');
    expect(resolveAMemberPrimaryPhone('+61 (0) 412 345 678')).toBe('61412345678');
  });

  it('combines mobile_area_code and mobile_number', () => {
    expect(resolveAMemberPrimaryPhone('5035551234', '1')).toBe('15035551234');
    expect(resolveAMemberPrimaryPhone('412345678', '61')).toBe('61412345678');
    expect(resolveAMemberPrimaryPhone('0412345678', '61')).toBe('61412345678');
    expect(resolveAMemberPrimaryPhone('(503) 555-1234', '+1')).toBe('15035551234');
  });

  it('returns undefined for empty or invalid numbers', () => {
    expect(resolveAMemberPrimaryPhone(undefined)).toBeUndefined();
    expect(resolveAMemberPrimaryPhone('   ')).toBeUndefined();
    expect(resolveAMemberPrimaryPhone('123')).toBeUndefined();
    expect(resolveAMemberPrimaryPhone(undefined, '1')).toBeUndefined();
  });
});

describe('aMember password import', () => {
  it('prefers crypt_pass over legacy pass column', () => {
    expect(
      resolveAMemberPasswordImport({
        cryptPass: '$1$Z9lyfh18$8211iUtJxjhYUSmKmmCNS/',
        passwordHash: '$P$Ba8vv/yagKHIyocKZBku1Z60QwfJdf.',
      })
    ).toEqual({
      passwordEncrypted: JSON.stringify([
        'crypt-md5',
        ['@'],
        '$1$Z9lyfh18$8211iUtJxjhYUSmKmmCNS/',
      ]),
      passwordEncryptionMethod: 'Legacy',
    });
  });

  it('maps phpass pass column values to legacy storage', () => {
    expect(
      resolveAMemberPasswordImport({
        passwordHash: '$P$Ba8vv/yagKHIyocKZBku1Z60QwfJdf.',
      })
    ).toEqual({
      passwordEncrypted: JSON.stringify([
        'phpass',
        ['@'],
        '$P$Ba8vv/yagKHIyocKZBku1Z60QwfJdf.',
      ]),
      passwordEncryptionMethod: 'Legacy',
    });
  });
});

describe('aMember user activity', () => {
  it('detects locked, deleted, or inactive status', () => {
    expect(isAMemberUserActive({ userId: 1, login: 'a', isLocked: true })).toBe(false);
    expect(isAMemberUserActive({ userId: 1, login: 'a', isDeleted: true })).toBe(false);
    expect(isAMemberUserActive({ userId: 1, login: 'a', status: 2 })).toBe(false);
    expect(isAMemberUserActive({ userId: 1, login: 'a', status: 0 })).toBe(true);
    expect(isAMemberUserActive({ userId: 1, login: 'a', status: 1 })).toBe(true);
  });
});
