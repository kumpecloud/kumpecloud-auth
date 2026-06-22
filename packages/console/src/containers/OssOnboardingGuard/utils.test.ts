import { getOssOnboardingRedirectPath } from './utils';

describe('OSS onboarding guard utils', () => {
  test('never redirects to onboarding', () => {
    expect(
      getOssOnboardingRedirectPath({
        isCloud: false,
        isDevFeaturesEnabled: true,
        isProduction: true,
        hasError: false,
        isLoading: false,
        isOnboardingDone: false,
        tenantId: 'console',
        pathname: '/console/get-started',
      })
    ).toBeUndefined();
  });
});
