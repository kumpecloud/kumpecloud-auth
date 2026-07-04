import { AccountCenterControlValue, type AccountCenter } from '@logto/schemas';

import { aMemberOutboundSignUpProfileFieldNames } from './sign-up-profile-fields.js';

/** Ensure account center exposes aMember-required profile fields when outbound sync is on. */
export const applyAMemberOutboundAccountCenterProfileFields = (
  accountCenter: AccountCenter
): AccountCenter => {
  const existing = accountCenter.profileFields ?? [];
  const existingNames = new Set(existing.map(({ name }) => name));
  const profileFields = [...existing];

  for (const name of aMemberOutboundSignUpProfileFieldNames) {
    if (!existingNames.has(name)) {
      profileFields.push({ name });
    }
  }

  return {
    ...accountCenter,
    profileFields,
    fields: {
      ...accountCenter.fields,
      profile: accountCenter.fields.profile ?? AccountCenterControlValue.Edit,
    },
  };
};
