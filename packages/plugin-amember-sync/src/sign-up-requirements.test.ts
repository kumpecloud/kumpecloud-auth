import { describe, expect, it } from 'vitest';

import { applyAMemberOutboundSignUpRequirements } from './sign-up-requirements.js';

describe('applyAMemberOutboundSignUpRequirements()', () => {
  it('adds email, username, and password when missing', () => {
    const signUp = {
      identifiers: ['username' as const],
      password: false,
      verify: false,
    };

    expect(applyAMemberOutboundSignUpRequirements(signUp)).toEqual({
      identifiers: ['username'],
      password: true,
      verify: false,
      secondaryIdentifiers: [{ identifier: 'email' }],
    });
  });

  it('does not duplicate existing email and username requirements', () => {
    const signUp = {
      identifiers: ['email' as const],
      password: true,
      verify: true,
      secondaryIdentifiers: [{ identifier: 'username' as const }],
    };

    expect(applyAMemberOutboundSignUpRequirements(signUp)).toEqual(signUp);
  });

  it('replaces emailOrPhone with explicit email requirement', () => {
    const signUp = {
      identifiers: ['username' as const],
      password: true,
      verify: false,
      secondaryIdentifiers: [{ identifier: 'emailOrPhone' as const, verify: true }],
    };

    expect(applyAMemberOutboundSignUpRequirements(signUp)).toEqual({
      identifiers: ['username'],
      password: true,
      verify: false,
      secondaryIdentifiers: [{ identifier: 'email' }],
    });
  });
});

describe('getAMemberOutboundMandatoryProfiles()', () => {
  it('requires email, username, and password', async () => {
    const { getAMemberOutboundMandatoryProfiles } = await import('./sign-up-requirements.js');

    expect([...getAMemberOutboundMandatoryProfiles()]).toEqual([
      'email',
      'username',
      'password',
    ]);
  });
});
