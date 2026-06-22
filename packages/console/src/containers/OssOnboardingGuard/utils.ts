type GetOssOnboardingRedirectPathOptions = {
  isCloud: boolean;
  isDevFeaturesEnabled: boolean;
  isProduction: boolean;
  hasError: boolean;
  isLoading: boolean;
  isOnboardingDone: boolean;
  tenantId: string;
  pathname: string;
};

export const getOssOnboardingRedirectPath = (
  _options: GetOssOnboardingRedirectPathOptions
): string | undefined => undefined;
