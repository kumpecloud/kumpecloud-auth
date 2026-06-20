type ShouldShowSamlAppLimitNoticeOptions = {
  readonly isCloud: boolean;
  readonly isThirdPartyTab: boolean;
  readonly samlAppTotalCount?: number;
};

/** OSS instances no longer enforce a SAML application limit. */
export const shouldShowSamlAppLimitNotice = (_: ShouldShowSamlAppLimitNoticeOptions) => false;
