import { CustomProfileFieldType } from '@logto/schemas';
import { describe, expect, it } from 'vitest';

import {
  applyAMemberOutboundSignUpProfileFields,
  createAMemberOutboundDefaultProfileFields,
  validateAMemberOutboundUserProfile,
} from './sign-up-profile-fields.js';

describe('applyAMemberOutboundSignUpProfileFields()', () => {
  it('adds required profile fields to an empty catalog', () => {
    const { catalog, signUpProfileFields } = applyAMemberOutboundSignUpProfileFields([], null);

    expect(catalog.map(({ name }) => name)).toEqual(['fullname', 'birthdate', 'address']);
    expect(signUpProfileFields).toBeNull();
  });

  it('appends required fields to an explicit sign-up field list', () => {
    const { catalog, signUpProfileFields } = applyAMemberOutboundSignUpProfileFields(
      [],
      [{ name: 'website' }]
    );

    expect(catalog.map(({ name }) => name)).toEqual(['fullname', 'birthdate', 'address']);
    expect(signUpProfileFields).toEqual([
      { name: 'website' },
      { name: 'fullname' },
      { name: 'birthdate' },
      { name: 'address' },
    ]);
  });

  it('forces outbound-required fields to be required', () => {
    const { catalog } = applyAMemberOutboundSignUpProfileFields(
      [
        {
          name: 'address',
          type: CustomProfileFieldType.Address,
          required: false,
          config: {
            parts: [
              {
                name: 'streetAddress',
                enabled: true,
                type: CustomProfileFieldType.Text,
                required: false,
              },
            ],
          },
        },
      ],
      null
    );

    const address = catalog.find(({ name }) => name === 'address');

    expect(address?.required).toBe(true);
    expect(address?.type).toBe(CustomProfileFieldType.Address);
  });
});

describe('validateAMemberOutboundUserProfile()', () => {
  it('accepts a complete profile', () => {
    expect(
      validateAMemberOutboundUserProfile({
        givenName: 'Jane',
        familyName: 'Doe',
        birthdate: '1990-01-01',
        address: {
          streetAddress: '123 Main St',
          locality: 'Springfield',
          region: 'IL',
          postalCode: '62701',
        },
      })
    ).toEqual([]);
  });

  it('reports missing address and name fields', () => {
    expect(validateAMemberOutboundUserProfile({})).toEqual([
      'givenName',
      'familyName',
      'birthdate',
      'streetAddress',
      'locality',
      'region',
      'postalCode',
    ]);
  });
});

describe('createAMemberOutboundDefaultProfileFields()', () => {
  it('includes first name, last name, birthdate, and US address parts', () => {
    const fields = createAMemberOutboundDefaultProfileFields();
    const address = fields.find(({ name }) => name === 'address');

    expect(fields.map(({ name }) => name)).toEqual(['fullname', 'birthdate', 'address']);
    expect(address?.config.parts?.map(({ name }) => name)).toEqual([
      'streetAddress',
      'locality',
      'region',
      'postalCode',
    ]);
  });
});
