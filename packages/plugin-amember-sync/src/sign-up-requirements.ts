import type { MissingProfile, SignUp, SignUpIdentifier } from '@logto/schemas';

const signInIdentifier = {
  username: 'username',
  email: 'email',
} as const;

const alternativeSignUpIdentifier = {
  emailOrPhone: 'emailOrPhone',
} as const;

const missingProfile = {
  email: 'email',
  username: 'username',
  password: 'password',
} as const satisfies Record<string, MissingProfile>;

const hasPrimaryIdentifier = (signUp: SignUp, identifier: SignUpIdentifier) =>
  signUp.identifiers.includes(identifier as SignUp['identifiers'][number]);

const hasSecondaryIdentifier = (signUp: SignUp, identifier: SignUpIdentifier) =>
  signUp.secondaryIdentifiers?.some((entry) => entry.identifier === identifier) ?? false;

const hasEmailSignUpRequirement = (signUp: SignUp) =>
  hasPrimaryIdentifier(signUp, signInIdentifier.email) ||
  hasSecondaryIdentifier(signUp, signInIdentifier.email);

const hasUsernameSignUpRequirement = (signUp: SignUp) =>
  hasPrimaryIdentifier(signUp, signInIdentifier.username) ||
  hasSecondaryIdentifier(signUp, signInIdentifier.username);

/**
 * When outbound aMember sync is enabled, signups must collect email, username, and password.
 * Augments sign-in experience sign-up settings without persisting changes to the database.
 */
export const applyAMemberOutboundSignUpRequirements = (signUp: SignUp): SignUp => {
  const secondaryIdentifiers = (signUp.secondaryIdentifiers ?? []).filter(
    (entry) => entry.identifier !== alternativeSignUpIdentifier.emailOrPhone
  );

  const addSecondaryIdentifier = (identifier: SignUpIdentifier) => {
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
  ]);
