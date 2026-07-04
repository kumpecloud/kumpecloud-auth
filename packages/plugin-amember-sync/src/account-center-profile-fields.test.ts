import { AccountCenterControlValue } from '@logto/schemas';
import { describe, expect, it } from 'vitest';

import { applyAMemberOutboundAccountCenterProfileFields } from './account-center-profile-fields.js';

const createAccountCenter = () => ({
  tenantId: 'tenant-1',
  id: 'default',
  enabled: true,
  fields: {
    name: AccountCenterControlValue.Off,
    avatar: AccountCenterControlValue.Off,
    profile: AccountCenterControlValue.Off,
    username: AccountCenterControlValue.Off,
    email: AccountCenterControlValue.Edit,
    phone: AccountCenterControlValue.Off,
    password: AccountCenterControlValue.Off,
    social: AccountCenterControlValue.Off,
    mfa: AccountCenterControlValue.Off,
    passkey: AccountCenterControlValue.Off,
    customData: AccountCenterControlValue.Off,
    session: AccountCenterControlValue.Off,
  },
  profileFields: [],
  gravatarEnabled: false,
  deleteAccountUrl: null,
});

describe('applyAMemberOutboundAccountCenterProfileFields()', () => {
  it('adds aMember profile fields and enables profile editing', () => {
    const accountCenter = applyAMemberOutboundAccountCenterProfileFields(createAccountCenter());

    expect(accountCenter.profileFields.map(({ name }) => name)).toEqual([
      'fullname',
      'birthdate',
      'address',
    ]);
    expect(accountCenter.fields.profile).toBe(AccountCenterControlValue.Edit);
  });

  it('preserves existing profile field entries', () => {
    const accountCenter = applyAMemberOutboundAccountCenterProfileFields({
      ...createAccountCenter(),
      profileFields: [{ name: 'nickname' }],
    });

    expect(accountCenter.profileFields.map(({ name }) => name)).toEqual([
      'nickname',
      'fullname',
      'birthdate',
      'address',
    ]);
  });
});
