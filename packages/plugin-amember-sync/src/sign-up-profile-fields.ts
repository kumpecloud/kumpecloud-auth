import {
  CustomProfileFieldType,
  SupportedDateFormat,
  type AddressProfileField,
  type CustomProfileFieldUnion,
  type DateProfileField,
  type FullnameProfileField,
  type SignInExperience,
  type SignUpProfileFields,
  type UserProfile,
} from '@logto/schemas';

export const aMemberOutboundSignUpProfileFieldNames = [
  'fullname',
  'birthdate',
  'address',
] as const;

export type AMemberOutboundSignUpProfileFieldName =
  (typeof aMemberOutboundSignUpProfileFieldNames)[number];

const createFullnameField = (): FullnameProfileField => ({
  name: 'fullname',
  type: CustomProfileFieldType.Fullname,
  label: 'Full name',
  required: true,
  config: {
    parts: [
      {
        name: 'givenName',
        enabled: true,
        type: CustomProfileFieldType.Text,
        label: 'First name',
        required: true,
      },
      {
        name: 'familyName',
        enabled: true,
        type: CustomProfileFieldType.Text,
        label: 'Last name',
        required: true,
      },
    ],
  },
});

const createBirthdateField = (): DateProfileField => ({
  name: 'birthdate',
  type: CustomProfileFieldType.Date,
  label: 'Date of birth',
  required: true,
  config: {
    format: SupportedDateFormat.ISO,
  },
});

const createAddressField = (): AddressProfileField => ({
  name: 'address',
  type: CustomProfileFieldType.Address,
  label: 'Address',
  required: true,
  config: {
    parts: [
      {
        name: 'streetAddress',
        enabled: true,
        type: CustomProfileFieldType.Text,
        label: 'Street address',
        required: true,
      },
      {
        name: 'locality',
        enabled: true,
        type: CustomProfileFieldType.Text,
        label: 'City',
        required: true,
      },
      {
        name: 'region',
        enabled: true,
        type: CustomProfileFieldType.Text,
        label: 'State',
        required: true,
      },
      {
        name: 'postalCode',
        enabled: true,
        type: CustomProfileFieldType.Text,
        label: 'ZIP code',
        required: true,
      },
    ],
  },
});

/** Default sign-up profile fields required for aMember outbound sync. */
export const createAMemberOutboundDefaultProfileFields = (): CustomProfileFieldUnion[] => [
  createFullnameField(),
  createBirthdateField(),
  createAddressField(),
];

const ensureOutboundRequiredField = (
  catalogByName: Map<string, CustomProfileFieldUnion>,
  field: CustomProfileFieldUnion
) => {
  const existing = catalogByName.get(field.name);

  if (!existing) {
    catalogByName.set(field.name, field);
    return;
  }

  catalogByName.set(field.name, {
    ...field,
    label: existing.label ?? field.label,
    description: existing.description ?? field.description,
    required: true,
  });
};

/**
 * When outbound aMember sync is enabled, ensure sign-up collects name, birthdate, and address.
 * Augments the profile field catalog and sign-up field list without persisting to the database.
 */
export const applyAMemberOutboundSignUpProfileFields = (
  catalog: Readonly<CustomProfileFieldUnion[]>,
  signUpProfileFields: SignInExperience['signUpProfileFields']
): {
  catalog: CustomProfileFieldUnion[];
  signUpProfileFields: SignInExperience['signUpProfileFields'];
} => {
  const catalogByName = new Map(catalog.map((field) => [field.name, field]));

  for (const field of createAMemberOutboundDefaultProfileFields()) {
    ensureOutboundRequiredField(catalogByName, field);
  }

  const mergedCatalog = [...catalogByName.values()];
  const requiredItems: SignUpProfileFields = aMemberOutboundSignUpProfileFieldNames.map((name) => ({
    name,
  }));

  if (!signUpProfileFields) {
    return {
      catalog: mergedCatalog,
      signUpProfileFields: null,
    };
  }

  const signUpFieldNames = new Set(signUpProfileFields.map(({ name }) => name));

  return {
    catalog: mergedCatalog,
    signUpProfileFields: [
      ...signUpProfileFields,
      ...requiredItems.filter(({ name }) => !signUpFieldNames.has(name)),
    ],
  };
};

export const validateAMemberOutboundUserProfile = (profile?: UserProfile | null): string[] => {
  const missing: string[] = [];

  if (!profile?.givenName?.trim()) {
    missing.push('givenName');
  }

  if (!profile?.familyName?.trim()) {
    missing.push('familyName');
  }

  if (!profile?.birthdate?.trim()) {
    missing.push('birthdate');
  }

  const address = profile?.address;

  if (!address?.streetAddress?.trim()) {
    missing.push('streetAddress');
  }

  if (!address?.locality?.trim()) {
    missing.push('locality');
  }

  if (!address?.region?.trim()) {
    missing.push('region');
  }

  if (!address?.postalCode?.trim()) {
    missing.push('postalCode');
  }

  return missing;
};
