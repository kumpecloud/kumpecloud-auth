import { useFormContext } from 'react-hook-form';

import { latestProPlanId } from '@/consts/subscriptions';
import FormField from '@/ds-components/FormField';
import Switch from '@/ds-components/Switch';

import type { SignInExperienceForm } from '../../../types';

type Props = {
  readonly variant: 'cloud' | 'oss';
  readonly isEnabledInCloud: boolean;
};

function HideLogtoBrandingField({ variant, isEnabledInCloud }: Props) {
  const { register } = useFormContext<SignInExperienceForm>();

  if (variant === 'cloud') {
    return (
      <FormField
        title="sign_in_exp.branding.hide_logto_branding"
        featureTag={{
          isVisible: !isEnabledInCloud,
          plan: latestProPlanId,
        }}
      >
        <Switch
          description="sign_in_exp.branding.hide_logto_branding_description"
          {...register('hideLogtoBranding')}
          disabled={!isEnabledInCloud}
        />
      </FormField>
    );
  }

  return (
    <FormField title="sign_in_exp.branding.hide_logto_branding">
      <Switch
        description="sign_in_exp.branding.hide_logto_branding_description"
        {...register('hideLogtoBranding')}
      />
    </FormField>
  );
}

export default HideLogtoBrandingField;
