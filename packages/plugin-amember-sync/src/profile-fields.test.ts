import { describe, expect, it } from 'vitest';

import {
  buildLogtoUserToAMemberFields,
  parseAMemberUserProfileFields,
  resolveDatabaseUserSelectColumns,
  wasRecentlyPushedToAMember,
} from './profile-fields.js';

describe('resolveDatabaseUserSelectColumns', () => {
  const baseColumns = new Set([
    'user_id',
    'login',
    'email',
    'crypt_pass',
    'mobile_area_code',
    'mobile_number',
  ]);

  it('prefers is_approved when both approval columns exist', () => {
    expect(
      resolveDatabaseUserSelectColumns(
        new Set([...baseColumns, 'is_aproved', 'is_approved', 'status'])
      )
    ).toEqual([
      'user_id',
      'login',
      'email',
      'crypt_pass',
      'mobile_area_code',
      'mobile_number',
      'is_approved',
      'status',
    ]);
  });

  it('selects is_aproved when is_approved is absent', () => {
    expect(
      resolveDatabaseUserSelectColumns(new Set([...baseColumns, 'is_approved', 'name_f']))
    ).toEqual([
      'user_id',
      'login',
      'email',
      'crypt_pass',
      'mobile_area_code',
      'mobile_number',
      'is_approved',
      'name_f',
    ]);
  });

  it('omits optional profile columns that are not present', () => {
    expect(resolveDatabaseUserSelectColumns(new Set([...baseColumns, 'status']))).toEqual([
      'user_id',
      'login',
      'email',
      'crypt_pass',
      'mobile_area_code',
      'mobile_number',
      'status',
    ]);
  });

  it('throws when required base columns are missing', () => {
    expect(() => resolveDatabaseUserSelectColumns(new Set(['user_id', 'login']))).toThrow(
      'Missing required aMember user columns'
    );
  });
});

describe('parseAMemberUserProfileFields', () => {
  it('reads is_approved from rows that use the corrected column name', () => {
    expect(
      parseAMemberUserProfileFields({
        is_approved: 1,
      })
    ).toEqual(
      expect.objectContaining({
        isApproved: true,
      })
    );
  });

  it('prefers is_approved over is_aproved when both columns are present', () => {
    expect(
      parseAMemberUserProfileFields({
        is_approved: 1,
        is_aproved: 0,
      })
    ).toEqual(
      expect.objectContaining({
        isApproved: true,
      })
    );
  });
});

describe('buildLogtoUserToAMemberFields', () => {
  it('prefers Logto profile values over stale customData.amember profile fields', () => {
    expect(
      buildLogtoUserToAMemberFields({
        username: 'jane',
        primaryEmail: 'jane@example.com',
        profile: {
          givenName: 'Jane',
          familyName: 'Doe',
          address: {
            postalCode: '62701',
          },
        },
        customData: {
          amember: {
            userId: 1,
            name_f: '62701',
            name_l: 'Jane',
            zip: '99999',
          },
        },
      })
    ).toEqual(
      expect.objectContaining({
        login: 'jane',
        email: 'jane@example.com',
        name_f: 'Jane',
        name_l: 'Doe',
        zip: '62701',
      })
    );
  });

  it('maps address fields to aMember columns', () => {
    expect(
      buildLogtoUserToAMemberFields({
        username: 'jane',
        primaryEmail: 'jane@example.com',
        profile: {
          givenName: 'Jane',
          familyName: 'Doe',
          address: {
            streetAddress: '123 Main St',
            locality: 'Springfield',
            region: 'IL',
            postalCode: '62701',
          },
        },
      })
    ).toEqual(
      expect.objectContaining({
        name_f: 'Jane',
        name_l: 'Doe',
        street: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
      })
    );
  });
});

describe('wasRecentlyPushedToAMember', () => {
  it('returns true when last push is within the window', () => {
    expect(
      wasRecentlyPushedToAMember({
        amember: { lastOutboundPushAt: Date.now() - 1_000 },
      })
    ).toBe(true);
  });

  it('returns false when last push timestamp is in the future', () => {
    expect(
      wasRecentlyPushedToAMember({
        amember: { lastOutboundPushAt: Date.now() + 60_000 },
      })
    ).toBe(false);
  });
});
