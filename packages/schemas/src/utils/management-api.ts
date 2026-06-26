import { managementApiHostSuffix } from '../constants/management-api.js';

/** Legacy Logto Cloud indicator suffix; kept for recognizing pre-migration resources. */
const legacyManagementApiHostSuffix = 'logto.app';

export const isManagementApi = (indicator: string) =>
  new RegExp(
    `^https:\\/\\/[^.]+\\.(?:${managementApiHostSuffix}|${legacyManagementApiHostSuffix})\\/api$`,
    'u'
  ).test(indicator);
