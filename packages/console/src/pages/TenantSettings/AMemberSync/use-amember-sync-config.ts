import { type AMemberSyncConfigPatch, type AMemberSyncConfigResponse } from '@logto/schemas';
import { useMemo } from 'react';
import useSWR from 'swr';

import useApi, { type RequestError } from '@/hooks/use-api';

const useAMemberSyncConfig = () => {
  const { data, error, isLoading, mutate } = useSWR<AMemberSyncConfigResponse, RequestError>(
    'api/configs/amember-sync'
  );
  const api = useApi();

  return useMemo(
    () => ({
      data,
      error,
      isLoading,
      mutate,
      updateConfig: async (config: AMemberSyncConfigPatch) => {
        const updated = await api
          .patch('api/configs/amember-sync', { json: config })
          .json<AMemberSyncConfigResponse>();
        void mutate(updated);
        return updated;
      },
      runSync: async () => {
        await api.post('api/configs/amember-sync/run');
      },
    }),
    [api, data, error, isLoading, mutate]
  );
};

export default useAMemberSyncConfig;
