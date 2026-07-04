import {
  applyAMemberOutboundAccountCenterProfileFields,
  resolveAMemberOutboundConfig,
} from '@logto/plugin-amember-sync';
import { amemberSyncStoredConfigGuard, type AccountCenter } from '@logto/schemas';

import type Queries from '#src/tenants/Queries.js';

export const resolveAccountCenterForRequest = async (
  queries: Queries
): Promise<AccountCenter> => {
  const accountCenter = await queries.accountCenters.findDefaultAccountCenter();

  if (!accountCenter.enabled) {
    return accountCenter;
  }

  const stored =
    (await queries.logtoConfigs.getAMemberSyncConfig()) ??
    amemberSyncStoredConfigGuard.parse({ enabled: false });
  const outboundConfig = resolveAMemberOutboundConfig(accountCenter.tenantId, stored);

  if (!outboundConfig) {
    return accountCenter;
  }

  return applyAMemberOutboundAccountCenterProfileFields(accountCenter);
};
