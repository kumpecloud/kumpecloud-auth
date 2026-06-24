import { describe, expect, it } from 'vitest';

import {
  buildAMemberRoleName,
  isAMemberRoleName,
  parseAMemberProductIdFromRoleName,
} from './constants.js';
import { isAccessActive, isAMemberUserActive, resolveAMemberUserEmail } from './utils.js';

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
});

describe('aMember user activity', () => {
  it('detects locked, deleted, or inactive status', () => {
    expect(isAMemberUserActive({ userId: 1, login: 'a', isLocked: true })).toBe(false);
    expect(isAMemberUserActive({ userId: 1, login: 'a', isDeleted: true })).toBe(false);
    expect(isAMemberUserActive({ userId: 1, login: 'a', status: 2 })).toBe(false);
    expect(isAMemberUserActive({ userId: 1, login: 'a', status: 1 })).toBe(true);
  });
});
