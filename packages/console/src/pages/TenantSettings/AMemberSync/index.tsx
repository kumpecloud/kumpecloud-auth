import { type AMemberSyncConfigResponse } from '@logto/schemas';
import { useEffect, useMemo } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import DetailsForm from '@/components/DetailsForm';
import FormCard from '@/components/FormCard';
import PageMeta from '@/components/PageMeta';
import Button from '@/ds-components/Button';
import DynamicT from '@/ds-components/DynamicT';
import FormField from '@/ds-components/FormField';
import InlineNotification from '@/ds-components/InlineNotification';
import Select, { type Option } from '@/ds-components/Select';
import Switch from '@/ds-components/Switch';
import TextInput from '@/ds-components/TextInput';
import { trySubmitSafe } from '@/utils/form';

import styles from './index.module.scss';
import useAMemberSyncConfig from './use-amember-sync-config';

type FormData = {
  enabled: boolean;
  outboundEnabled: boolean;
  roleSyncMode: 'one_way' | 'two_way';
  inboundMode: 'api' | 'database';
  intervalSeconds: number;
  syncPasswords: boolean;
  tablePrefix: string;
  apiUrl: string;
  apiKey: string;
  databaseUrl: string;
};

const defaultFormData: FormData = {
  enabled: false,
  outboundEnabled: true,
  roleSyncMode: 'one_way',
  inboundMode: 'database',
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
  outboundEnabled: data?.outboundEnabled ?? defaultFormData.outboundEnabled,
  roleSyncMode: data?.roleSyncMode ?? defaultFormData.roleSyncMode,
  inboundMode: data?.inboundMode ?? defaultFormData.inboundMode,
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
    control,
    handleSubmit,
    formState: { isDirty, isSubmitting },
  } = methods;
  const [enabled, inboundMode, outboundEnabled, apiUrl, apiKey, databaseUrl] = watch([
    'enabled',
    'inboundMode',
    'outboundEnabled',
    'apiUrl',
    'apiKey',
    'databaseUrl',
  ]);
  const isDatabaseInbound = inboundMode === 'database';
  const needsApiCredentials = outboundEnabled || inboundMode === 'api';

  const inboundModeOptions = useMemo<Array<Option<'api' | 'database'>>>(
    () => [
      { value: 'database', title: t('tenants.amember_sync.mode_database') },
      { value: 'api', title: t('tenants.amember_sync.mode_api') },
    ],
    [t]
  );

  const roleSyncModeOptions = useMemo<Array<Option<'one_way' | 'two_way'>>>(
    () => [
      { value: 'one_way', title: t('tenants.amember_sync.role_sync_one_way') },
      { value: 'two_way', title: t('tenants.amember_sync.role_sync_two_way') },
    ],
    [t]
  );

  const databaseConfigured = Boolean(data?.databaseUrlSet || databaseUrl.trim());
  const apiConfigured = Boolean(data?.apiKeySet || (apiUrl.trim() && apiKey?.trim()));

  useEffect(() => {
    if (data) {
      reset(toFormData(data));
    }
  }, [data, reset]);

  const onSubmit = handleSubmit(
    trySubmitSafe(async (formData) => {
      await updateConfig({
        enabled: formData.enabled,
        outboundEnabled: formData.outboundEnabled,
        roleSyncMode: formData.roleSyncMode,
        inboundMode: formData.inboundMode,
        intervalSeconds: Number(formData.intervalSeconds),
        syncPasswords: formData.syncPasswords,
        tablePrefix: formData.tablePrefix,
        apiUrl: formData.apiUrl || undefined,
        apiKey: formData.apiKey || undefined,
        databaseUrl: formData.databaseUrl || undefined,
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
      <InlineNotification className={styles.callout}>
        <DynamicT forKey="tenants.amember_sync.hybrid_recommended" />
      </InlineNotification>
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
              <FormField title="tenants.amember_sync.role_sync_mode">
                <Controller
                  name="roleSyncMode"
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <Select
                      value={value}
                      options={roleSyncModeOptions}
                      onChange={(next) => {
                        if (next) {
                          onChange(next);
                        }
                      }}
                    />
                  )}
                />
              </FormField>
              <p className={styles.hint}>
                <DynamicT forKey="tenants.amember_sync.role_sync_hint" />
              </p>
              <p className={styles.hint}>
                <DynamicT forKey="tenants.amember_sync.identity_hint" />
              </p>
            </div>
          </FormCard>

          <FormCard title="tenants.amember_sync.inbound_title">
            <p className={styles.hint}>
              <DynamicT forKey="tenants.amember_sync.inbound_description" />
            </p>
            <div className={styles.card}>
              <FormField title="tenants.amember_sync.inbound_mode">
                <Controller
                  name="inboundMode"
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <Select
                      value={value}
                      options={inboundModeOptions}
                      onChange={(next) => {
                        if (next) {
                          onChange(next);
                        }
                      }}
                    />
                  )}
                />
              </FormField>

              {isDatabaseInbound ? (
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
                  <p className={styles.hint}>
                    {databaseConfigured
                      ? t('tenants.amember_sync.database_configured')
                      : t('tenants.amember_sync.database_not_configured')}
                  </p>
                  <FormField title="tenants.amember_sync.table_prefix">
                    <TextInput {...register('tablePrefix')} />
                  </FormField>
                </>
              ) : (
                <p className={styles.hint}>
                  <DynamicT forKey="tenants.amember_sync.inbound_api_hint" />
                </p>
              )}
            </div>
          </FormCard>

          <FormCard title="tenants.amember_sync.outbound_title">
            <p className={styles.hint}>
              <DynamicT forKey="tenants.amember_sync.outbound_description" />
            </p>
            <div className={styles.card}>
              <FormField title="tenants.amember_sync.outbound_enabled">
                <Switch {...register('outboundEnabled')} />
              </FormField>

              {needsApiCredentials ? (
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
                  <p className={styles.hint}>
                    {apiConfigured
                      ? t('tenants.amember_sync.api_configured')
                      : t('tenants.amember_sync.api_not_configured')}
                  </p>
                </>
              ) : null}
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
