import { CustomProfileFieldType, type CustomProfileField } from '@logto/schemas';
import { describe, expect, it } from 'vitest';

import {
  applyAMemberOutboundSignUpProfileFields,
  createAMemberOutboundDefaultProfileFields,
  validateAMemberOutboundUserProfile,
} from './sign-up-profile-fields.js';

const tenantId = 'default';

describe('applyAMemberOutboundSignUpProfileFields()', () => {
  it('adds required profile fields to an empty catalog', () => {
    const { catalog, signUpProfileFields } = applyAMemberOutboundSignUpProfileFields(
      tenantId,
      [],
      null
    );

    expect(catalog.map(({ name }) => name)).toEqual(['fullname', 'birthdate', 'address']);
    expect(signUpProfileFields).toEqual([
      { name: 'fullname' },
      { name: 'birthdate' },
      { name: 'address' },
    ]);
    expect(catalog.every((field) => field.tenantId === tenantId && field.id && field.sieOrder)).toBe(
      true
    );
  });

  it('uses only aMember-required fields during sign-up even when extra fields are configured', () => {
    const { catalog, signUpProfileFields } = applyAMemberOutboundSignUpProfileFields(
      tenantId,
      [],
      [{ name: 'website' }]
    );

    expect(catalog.map(({ name }) => name)).toEqual(['fullname', 'birthdate', 'address']);
    expect(signUpProfileFields).toEqual([
      { name: 'fullname' },
      { name: 'birthdate' },
      { name: 'address' },
    ]);
  });

  it('removes standalone profile fields that duplicate outbound composite fields', () => {
    const standaloneGivenName: CustomProfileField = {
      tenantId,
      id: 'given-name-text',
      name: 'givenName',
      type: CustomProfileFieldType.Text,
      label: 'ZIP code',
      description: '',
      required: true,
      createdAt: 1,
      sieOrder: 1,
    };

    const { catalog, signUpProfileFields } = applyAMemberOutboundSignUpProfileFields(
      tenantId,
      [standaloneGivenName],
      null
    );

    expect(catalog.map(({ name }) => name)).toEqual(['fullname', 'birthdate', 'address']);
    expect(signUpProfileFields).toEqual([
      { name: 'fullname' },
      { name: 'birthdate' },
      { name: 'address' },
    ]);
  });

  it('forces outbound-required fields to be required', () => {
    const existingAddress: CustomProfileField = {
      tenantId,
      id: 'existing-address',
      name: 'address',
      type: CustomProfileFieldType.Address,
      label: 'Mailing address',
      description: '',
      required: false,
      createdAt: 1,
      sieOrder: 2,
      config: {
        parts: [
          {
            name: 'streetAddress',
            enabled: true,
            type: CustomProfileFieldType.Text,
            required: false,
            label: 'Street',
          },
        ],
      },
    };

    const { catalog } = applyAMemberOutboundSignUpProfileFields(
      tenantId,
      [existingAddress],
      null
    );

    const address = catalog.find(({ name }) => name === 'address');

    expect(address?.required).toBe(true);
    expect(address?.id).toBe('existing-address');
    expect(address?.type).toBe(CustomProfileFieldType.Address);
    expect(address?.config.parts?.map(({ name }) => name)).toEqual([
      'streetAddress',
      'locality',
      'region',
      'postalCode',
    ]);
  });

  it('replaces misconfigured fullname parts with aMember-compatible defaults', () => {
    const malformedFullname: CustomProfileField = {
      tenantId,
      id: 'malformed-fullname',
      name: 'fullname',
      type: CustomProfileFieldType.Fullname,
      label: 'Name',
      description: '',
      required: false,
      createdAt: 1,
      sieOrder: 1,
      config: {
        parts: [
          {
            name: 'givenName',
            enabled: true,
            type: CustomProfileFieldType.Text,
            required: false,
            label: 'ZIP code',
          },
          {
            name: 'familyName',
            enabled: true,
            type: CustomProfileFieldType.Text,
            required: false,
            label: 'First name',
          },
        ],
      },
    };

    const { catalog } = applyAMemberOutboundSignUpProfileFields(
      tenantId,
      [malformedFullname],
      null
    );

    const fullname = catalog.find(({ name }) => name === 'fullname');

    expect(fullname?.config.parts).toEqual([
      expect.objectContaining({ name: 'givenName', label: 'First name', required: true }),
      expect.objectContaining({ name: 'familyName', label: 'Last name', required: true }),
    ]);
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
