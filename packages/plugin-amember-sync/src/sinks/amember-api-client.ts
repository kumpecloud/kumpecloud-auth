import got from 'got';

/**
 * aMember accepts auth via query `_key` or `X-API-Key` header.
 * got.extend searchParams are not reliably merged onto POST form requests, so always send the header.
 */
export const createAMemberApiClient = (apiUrl: string, apiKey: string) =>
  got.extend({
    prefixUrl: apiUrl.replace(/\/$/u, ''),
    headers: {
      'X-API-Key': apiKey,
    },
    searchParams: { _key: apiKey },
    responseType: 'json',
    // Never retry mutating POST requests; aMember may create duplicate users on replay.
    retry: { limit: 0 },
  });
