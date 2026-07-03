import {
  AlternativeSignUpIdentifier,
  MissingProfile,
  SignInIdentifier,
  type SignUp,
  type UserProfile,
} from '@logto/schemas';

import { validateAMemberOutboundUserProfile } from './sign-up-profile-fields.js';

const signInIdentifier = {
  username: SignInIdentifier.Username,
  email: SignInIdentifier.Email,
} as const;

const alternativeSignUpIdentifier = {
  emailOrPhone: AlternativeSignUpIdentifier.EmailOrPhone,
} as const;

const missingProfile = {
  email: MissingProfile.email,
  username: MissingProfile.username,
  password: MissingProfile.password,
  extraProfile: MissingProfile.extraProfile,
} as const satisfies Record<string, MissingProfile>;

// Primary and injected secondary identifiers are always SignInIdentifier values.
// AlternativeSignUpIdentifier (e.g. emailOrPhone) is only handled when filtering existing settings.
const hasPrimaryIdentifier = (signUp: SignUp, identifier: SignInIdentifier) =>
  signUp.identifiers.includes(identifier);

const hasSecondarySignInIdentifier = (signUp: SignUp, identifier: SignInIdentifier) =>
  signUp.secondaryIdentifiers?.some((entry) => entry.identifier === identifier) ?? false;

const hasEmailSignUpRequirement = (signUp: SignUp) =>
  hasPrimaryIdentifier(signUp, signInIdentifier.email) ||
  hasSecondarySignInIdentifier(signUp, signInIdentifier.email);

const hasUsernameSignUpRequirement = (signUp: SignUp) =>
  hasPrimaryIdentifier(signUp, signInIdentifier.username) ||
  hasSecondarySignInIdentifier(signUp, signInIdentifier.username);

/**
 * When outbound aMember sync is enabled, signups must collect email, username, and password.
 * Augments sign-in experience sign-up settings without persisting changes to the database.
 */
export const applyAMemberOutboundSignUpRequirements = (signUp: SignUp): SignUp => {
  const secondaryIdentifiers = (signUp.secondaryIdentifiers ?? []).filter(
    (entry) => entry.identifier !== alternativeSignUpIdentifier.emailOrPhone
  );

  const addSecondaryIdentifier = (identifier: SignInIdentifier) => {
    if (
      hasPrimaryIdentifier(signUp, identifier) ||
      secondaryIdentifiers.some((entry) => entry.identifier === identifier)
    ) {
      return;
    }

    secondaryIdentifiers.push({ identifier });
  };

  if (!hasEmailSignUpRequirement(signUp)) {
    addSecondaryIdentifier(signInIdentifier.email);
  }

  if (!hasUsernameSignUpRequirement(signUp)) {
    addSecondaryIdentifier(signInIdentifier.username);
  }

  return {
    ...signUp,
    password: true,
    secondaryIdentifiers,
  };
};

export const getAMemberOutboundMandatoryProfiles = (): Set<MissingProfile> =>
  new Set([
    missingProfile.email,
    missingProfile.username,
    missingProfile.password,
    missingProfile.extraProfile,
  ]);

export const assertAMemberOutboundUserProfile = (profile?: UserProfile | null): void => {
  if (validateAMemberOutboundUserProfile(profile).length > 0) {
    throw new Error(
      'Cannot push user to aMember without first name, last name, date of birth, and full address'
    );
  }
};
