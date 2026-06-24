import { type AMemberSyncConfigResponse } from '@logto/schemas';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import DetailsForm from '@/components/DetailsForm';
import FormCard from '@/components/FormCard';
import PageMeta from '@/components/PageMeta';
import Button from '@/ds-components/Button';
import DynamicT from '@/ds-components/DynamicT';
import FormField from '@/ds-components/FormField';
import Switch from '@/ds-components/Switch';
import TextInput from '@/ds-components/TextInput';
import { trySubmitSafe } from '@/utils/form';

import styles from './index.module.scss';
import useAMemberSyncConfig from './use-amember-sync-config';

type FormData = {
  enabled: boolean;
  mode: 'api' | 'database';
  intervalSeconds: number;
  syncPasswords: boolean;
  tablePrefix: string;
  apiUrl: string;
  apiKey: string;
  databaseUrl: string;
};

const defaultFormData: FormData = {
  enabled: false,
  mode: 'api',
  intervalSeconds: 3600,
  syncPasswords: true,
  tablePrefix: 'am_',
  apiUrl: '',
  apiKey: '',
  databaseUrl: '',
};

const toFormData = (data?: AMemberSyncConfigResponse): FormData => ({
  ...defaultFormData,
  enabled: data?.enabled ?? defaultFormData.enabled,
  mode: data?.mode ?? defaultFormData.mode,
  intervalSeconds: data?.intervalSeconds ?? defaultFormData.intervalSeconds,
  syncPasswords: data?.syncPasswords ?? defaultFormData.syncPasswords,
  tablePrefix: data?.tablePrefix ?? defaultFormData.tablePrefix,
  apiUrl: data?.apiUrl ?? defaultFormData.apiUrl,
});

function AMemberSyncSettings() {
  const { t } = useTranslation(undefined, { keyPrefix: 'admin_console' });
  const { data, isLoading, updateConfig, runSync } = useAMemberSyncConfig();
  const methods = useForm<FormData>({
    defaultValues: toFormData(),
  });
  const {
    register,
    reset,
    watch,
    handleSubmit,
    formState: { isDirty, isSubmitting },
  } = methods;
  const [enabled, mode] = watch(['enabled', 'mode']);
  const isApiMode = mode === 'api';

  useEffect(() => {
    if (data) {
      reset(toFormData(data));
    }
  }, [data, reset]);

  const onSubmit = handleSubmit(
    trySubmitSafe(async (formData) => {
      await updateConfig({
        enabled: formData.enabled,
        mode: formData.mode,
        intervalSeconds: Number(formData.intervalSeconds),
        syncPasswords: formData.syncPasswords,
        tablePrefix: formData.tablePrefix,
        apiUrl: formData.apiUrl,
        apiKey: formData.apiKey,
        databaseUrl: formData.databaseUrl,
      });
      toast.success(t('general.saved'));
    })
  );

  const onRunSync = async () => {
    await runSync();
    toast.success(t('tenants.amember_sync.sync_triggered'));
  };

  return (
    <div className={styles.container}>
      <PageMeta titleKey="tenants.amember_sync.title" />
      <p className={styles.hint}>
        <DynamicT forKey="tenants.amember_sync.description" />
      </p>
      <FormProvider {...methods}>
        <DetailsForm
          isDirty={isDirty}
          isSubmitting={isSubmitting || isLoading}
          onSubmit={onSubmit}
          onDiscard={() => {
            reset(toFormData(data));
          }}
        >
          <FormCard title="tenants.amember_sync.general_title">
            <div className={styles.card}>
              <FormField title="tenants.amember_sync.enabled">
                <Switch {...register('enabled')} />
              </FormField>
              <FormField title="tenants.amember_sync.interval_seconds">
                <TextInput type="number" min={60} {...register('intervalSeconds')} />
              </FormField>
              <FormField title="tenants.amember_sync.sync_passwords">
                <Switch {...register('syncPasswords')} />
              </FormField>
              <p className={styles.hint}>
                <DynamicT forKey="tenants.amember_sync.identity_hint" />
              </p>
            </div>
          </FormCard>

          <FormCard title="tenants.amember_sync.connection_title">
            <div className={styles.card}>
              <FormField title="tenants.amember_sync.mode">
                <select {...register('mode')}>
                  <option value="api">{t('tenants.amember_sync.mode_api')}</option>
                  <option value="database">{t('tenants.amember_sync.mode_database')}</option>
                </select>
              </FormField>

              {isApiMode ? (
                <>
                  <FormField title="tenants.amember_sync.api_url">
                    <TextInput
                      placeholder="https://billing.example.com/amember/api"
                      {...register('apiUrl')}
                    />
                  </FormField>
                  <FormField title="tenants.amember_sync.api_key">
                    <TextInput
                      type="password"
                      placeholder={
                        data?.apiKeySet
                          ? t('tenants.amember_sync.secret_saved_placeholder')
                          : undefined
                      }
                      {...register('apiKey')}
                    />
                  </FormField>
                </>
              ) : (
                <>
                  <FormField title="tenants.amember_sync.database_url">
                    <TextInput
                      type="password"
                      placeholder={
                        data?.databaseUrlSet
                          ? t('tenants.amember_sync.secret_saved_placeholder')
                          : 'mysql://user:pass@host:3306/amember'
                      }
                      {...register('databaseUrl')}
                    />
                  </FormField>
                  <FormField title="tenants.amember_sync.table_prefix">
                    <TextInput {...register('tablePrefix')} />
                  </FormField>
                </>
              )}
            </div>
          </FormCard>
        </DetailsForm>
      </FormProvider>

      <div className={styles.actions}>
        <Button
          title="tenants.amember_sync.run_now"
          type="primary"
          disabled={!enabled || isLoading}
          onClick={() => {
            void onRunSync();
          }}
        />
      </div>
    </div>
  );
}

export default AMemberSyncSettings;
