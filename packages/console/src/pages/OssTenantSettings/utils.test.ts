import type { TFuncKey } from 'i18next';

import { getOssTenantMembersUpsellCopyKeys, shouldShowOssTenantMembersTab } from './utils';

describe('shouldShowOssTenantMembersTab', () => {
  it('is disabled for self-hosted deployments', () => {
    expect(shouldShowOssTenantMembersTab({ isCloud: false })).toBe(false);
    expect(shouldShowOssTenantMembersTab({ isCloud: true })).toBe(false);
  });
});

describe('getOssTenantMembersUpsellCopyKeys', () => {
  it('uses dedicated i18n keys for the OSS members upsell card copy', () => {
    const copyKeys = getOssTenantMembersUpsellCopyKeys();
    const titleKey: TFuncKey<'translation', 'admin_console'> = copyKeys.title;
    const descriptionKey: TFuncKey<'translation', 'admin_console'> = copyKeys.description;
    const actionKey: TFuncKey<'translation', 'admin_console'> = copyKeys.action;

    expect({ title: titleKey, description: descriptionKey, action: actionKey }).toEqual({
      title: 'tenants.members.card_title',
      description: 'tenants.members.card_description',
      action: 'tenants.members.card_action',
    });
  });
});
