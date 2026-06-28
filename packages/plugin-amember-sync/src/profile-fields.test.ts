import { describe, expect, it } from 'vitest';

import {
  parseAMemberUserProfileFields,
  resolveDatabaseUserSelectColumns,
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
