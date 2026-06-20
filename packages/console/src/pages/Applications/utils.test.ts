import { shouldShowSamlAppLimitNotice } from './utils';

describe('shouldShowSamlAppLimitNotice', () => {
  it('does not show OSS SAML limit notices', () => {
    expect(
      shouldShowSamlAppLimitNotice({
        isCloud: false,
        isThirdPartyTab: false,
        samlAppTotalCount: 100,
      })
    ).toBe(false);
  });

  it('does not show on cloud either', () => {
    expect(
      shouldShowSamlAppLimitNotice({
        isCloud: true,
        isThirdPartyTab: false,
        samlAppTotalCount: 100,
      })
    ).toBe(false);
  });
});
