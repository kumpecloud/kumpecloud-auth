import got from 'got';

import type { AMemberAccess } from '../types.js';

export const amemberLifetimeExpireDate = '2037-12-31';

type ApiListResponse<T> = {
  _total?: number;
  _page?: number;
  _items?: T[];
};

type RawAccess = {
  access_id?: number;
  accessId?: number;
  user_id?: number;
  userId?: number;
  product_id?: number;
  productId?: number;
  begin_date?: string;
  beginDate?: string;
  expire_date?: string;
  expireDate?: string;
};

type RawUser = {
  user_id?: number;
  userId?: number;
};

const toNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
};

const extractItems = <T>(body: unknown): T[] => {
  if (Array.isArray(body)) {
    return body;
  }

  if (body && typeof body === 'object') {
    const response = body as ApiListResponse<T>;

    if (Array.isArray(response._items)) {
      return response._items;
    }
  }

  return [];
};

const mapAccess = (raw: RawAccess): (AMemberAccess & { accessId?: number }) | undefined => {
  const userId = toNumber(raw.user_id ?? raw.userId);
  const productId = toNumber(raw.product_id ?? raw.productId);
  const accessId = toNumber(raw.access_id ?? raw.accessId);

  if (userId === undefined || productId === undefined) {
    return;
  }

  return {
    accessId,
    userId,
    productId,
    beginDate: raw.begin_date ?? raw.beginDate,
    expireDate: raw.expire_date ?? raw.expireDate,
  };
};

const mapCreatedUserId = (body: unknown): number | undefined => {
  if (!body || typeof body !== 'object') {
    return;
  }

  const raw = body as RawUser;

  return toNumber(raw.user_id ?? raw.userId);
};

export type AMemberDataSink = {
  createUser: (fields: Record<string, string>) => Promise<number>;
  updateUser: (userId: number, fields: Record<string, string>) => Promise<void>;
  grantLifetimeAccess: (userId: number, productId: number) => Promise<void>;
  revokeProductAccess: (userId: number, productId: number) => Promise<void>;
};

export const createApiAMemberDataSink = ({
  apiUrl,
  apiKey,
}: {
  apiUrl: string;
  apiKey: string;
}): AMemberDataSink => {
  const client = got.extend({
    prefixUrl: apiUrl.replace(/\/$/u, ''),
    searchParams: { _key: apiKey },
    responseType: 'json',
    retry: { limit: 2 },
  });

  const findAccessRecord = async (userId: number, productId: number) => {
    const body = await client
      .get('access', {
        searchParams: {
          '_filter[user_id]': String(userId),
          '_filter[product_id]': String(productId),
        },
      })
      .json<unknown>();

    const records = extractItems<RawAccess>(body)
      .map((item) => mapAccess(item))
      .filter((item): item is AMemberAccess & { accessId?: number } => item !== undefined);

    return records[0];
  };

  return {
    createUser: async (fields) => {
      const body = await client
        .post('users', {
          form: fields,
        })
        .json<unknown>();

      const userId = mapCreatedUserId(body);

      if (userId === undefined) {
        throw new Error('aMember API did not return a user_id after create');
      }

      return userId;
    },
    updateUser: async (userId, fields) => {
      await client.post(`users/${userId}`, {
        searchParams: { _method: 'PUT' },
        form: fields,
      });
    },
    grantLifetimeAccess: async (userId, productId) => {
      const existing = await findAccessRecord(userId, productId);
      const today = new Date().toISOString().slice(0, 10);

      if (existing?.accessId) {
        await client.post(`access/${existing.accessId}`, {
          searchParams: { _method: 'PUT' },
          form: {
            expire_date: amemberLifetimeExpireDate,
          },
        });

        return;
      }

      await client.post('access', {
        form: {
          user_id: String(userId),
          product_id: String(productId),
          begin_date: today,
          expire_date: amemberLifetimeExpireDate,
        },
      });
    },
    revokeProductAccess: async (userId, productId) => {
      const existing = await findAccessRecord(userId, productId);

      if (!existing?.accessId) {
        return;
      }

      const today = new Date().toISOString().slice(0, 10);

      await client.post(`access/${existing.accessId}`, {
        searchParams: { _method: 'PUT' },
        form: {
          expire_date: today,
        },
      });
    },
  };
};
