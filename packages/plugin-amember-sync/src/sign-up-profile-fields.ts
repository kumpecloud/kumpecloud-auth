import {
  CustomProfileFieldType,
  SupportedDateFormat,
  type AddressProfileField,
  type CustomProfileField,
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

/** Stable synthetic IDs for runtime-only profile fields (max 21 chars). */
const outboundSyntheticFieldIds: Record<AMemberOutboundSignUpProfileFieldName, string> = {
  fullname: 'amember_ob_fullname',
  birthdate: 'amember_ob_birthdt',
  address: 'amember_ob_address',
};

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
export const createAMemberOutboundDefaultProfileFields = (): Array<
  FullnameProfileField | DateProfileField | AddressProfileField
> => [createFullnameField(), createBirthdateField(), createAddressField()];

const toSyntheticCustomProfileField = (
  tenantId: string,
  field: FullnameProfileField | DateProfileField | AddressProfileField,
  sieOrder: number
): CustomProfileField =>
  ({
    ...field,
    tenantId,
    id: outboundSyntheticFieldIds[field.name as AMemberOutboundSignUpProfileFieldName],
    description: '',
    required: true,
    createdAt: 0,
    sieOrder,
  }) as CustomProfileField;

const ensureOutboundRequiredField = (
  catalogByName: Map<string, CustomProfileField>,
  field: FullnameProfileField | DateProfileField | AddressProfileField,
  tenantId: string,
  allocateSieOrder: () => number
) => {
  const existing = catalogByName.get(field.name);

  if (existing && existing.type === field.type) {
    const merged = toSyntheticCustomProfileField(tenantId, field, existing.sieOrder);

    catalogByName.set(field.name, {
      ...merged,
      id: existing.id,
      createdAt: existing.createdAt,
      description: existing.description || merged.description,
      label: existing.label || merged.label,
    });
    return;
  }

  catalogByName.set(
    field.name,
    toSyntheticCustomProfileField(tenantId, field, allocateSieOrder())
  );
};

/**
 * When outbound aMember sync is enabled, ensure sign-up collects name, birthdate, and address.
 * Augments the profile field catalog and sign-up field list without persisting to the database.
 */
export const applyAMemberOutboundSignUpProfileFields = (
  tenantId: string,
  catalog: Readonly<CustomProfileField[]>,
  signUpProfileFields: SignInExperience['signUpProfileFields']
): {
  catalog: CustomProfileField[];
  signUpProfileFields: SignInExperience['signUpProfileFields'];
} => {
  const catalogByName = new Map(catalog.map((field) => [field.name, field]));
  const maxSieOrder = catalog.reduce((max, field) => Math.max(max, field.sieOrder), 0);
  let nextSieOrder = maxSieOrder;

  const allocateSieOrder = () => {
    nextSieOrder += 1;
    return nextSieOrder;
  };

  for (const field of createAMemberOutboundDefaultProfileFields()) {
    ensureOutboundRequiredField(catalogByName, field, tenantId, allocateSieOrder);
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
