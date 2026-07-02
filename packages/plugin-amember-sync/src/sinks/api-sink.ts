import got from 'got';

import type { AMemberAccess } from '../types.js';

import { createAMemberApiClient } from './amember-api-client.js';
import {
  executeAMemberJsonRequest,
  parseAMemberEntityId,
  readAMemberJsonResponse,
} from './api-response.js';

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

export type AMemberDataSink = {
  createUser: (fields: Record<string, string>) => Promise<number>;
  updateUser: (userId: number, fields: Record<string, string>) => Promise<void>;
  grantLifetimeAccess: (userId: number, productId: number) => Promise<void>;
  revokeProductAccess: (userId: number, productId: number) => Promise<void>;
};

type RawUser = {
  user_id?: number;
  userId?: number;
  login?: string;
  email?: string;
};

const findUserIdByLoginOrEmail = async (
  client: ReturnType<typeof createAMemberApiClient>,
  { login, email }: { login?: string; email?: string }
): Promise<number | undefined> => {
  const filters: Array<Record<string, string>> = [];

  if (login?.trim()) {
    filters.push({ '_filter[login]': login.trim() });
  }

  if (email?.trim()) {
    filters.push({ '_filter[email]': email.trim() });
  }

  for (const searchParams of filters) {
    const body = await executeAMemberJsonRequest('find user', () =>
      client.get('users', { searchParams }).json<unknown>()
    );

    const [user] = extractItems<RawUser>(body);
    const userId = toNumber(user?.user_id ?? user?.userId);

    if (userId !== undefined) {
      return userId;
    }
  }

  return;
};

const isRecoverableCreateUserResponseError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('unexpected response') ||
    error.message.includes('did not return a user id') ||
    error.message.includes('returned no response body')
  );
};

export const createApiAMemberDataSink = ({
  apiUrl,
  apiKey,
}: {
  apiUrl: string;
  apiKey: string;
}): AMemberDataSink => {
  const client = createAMemberApiClient(apiUrl, apiKey);

  const findAccessRecord = async (userId: number, productId: number) => {
    const body = await readAMemberJsonResponse('list access', () =>
      client
        .get('access', {
          searchParams: {
            '_filter[user_id]': String(userId),
            '_filter[product_id]': String(productId),
          },
        })
        .json<unknown>()
    );

    const records = extractItems<RawAccess>(body)
      .map((item) => mapAccess(item))
      .filter((item): item is AMemberAccess & { accessId?: number } => item !== undefined);

    return records[0];
  };

  return {
    createUser: async (fields) => {
      try {
        const body = await readAMemberJsonResponse('create user', () =>
          client
            .post('users', {
              form: fields,
            })
            .json<unknown>()
        );

        return parseAMemberEntityId(body, ['user_id', 'userId'], 'user', 'create user');
      } catch (error: unknown) {
        if (!isRecoverableCreateUserResponseError(error)) {
          throw error;
        }

        const recoveredUserId = await findUserIdByLoginOrEmail(client, fields);

        if (recoveredUserId !== undefined) {
          return recoveredUserId;
        }

        throw error;
      }
    },
    updateUser: async (userId, fields) => {
      await readAMemberJsonResponse('update user', () =>
        client
          .post(`users/${userId}`, {
            searchParams: { _method: 'PUT' },
            form: fields,
          })
          .json<unknown>()
      );
    },
    grantLifetimeAccess: async (userId, productId) => {
      const existing = await findAccessRecord(userId, productId);
      const today = new Date().toISOString().slice(0, 10);

      if (existing?.accessId) {
        await readAMemberJsonResponse('extend access', () =>
          client
            .post(`access/${existing.accessId}`, {
              searchParams: { _method: 'PUT' },
              form: {
                expire_date: amemberLifetimeExpireDate,
              },
            })
            .json<unknown>()
        );

        return;
      }

      await readAMemberJsonResponse('create access', () =>
        client
          .post('access', {
            form: {
              user_id: String(userId),
              product_id: String(productId),
              begin_date: today,
              expire_date: amemberLifetimeExpireDate,
            },
          })
          .json<unknown>()
      );

      const created = await findAccessRecord(userId, productId);

      if (!created?.accessId) {
        throw new Error(
          `aMember API create access did not persist access for user ${userId} and product ${productId}`
        );
      }
    },
    revokeProductAccess: async (userId, productId) => {
      const existing = await findAccessRecord(userId, productId);

      if (!existing?.accessId) {
        return;
      }

      const today = new Date().toISOString().slice(0, 10);

      await readAMemberJsonResponse('revoke access', () =>
        client
          .post(`access/${existing.accessId}`, {
            searchParams: { _method: 'PUT' },
            form: {
              expire_date: today,
            },
          })
          .json<unknown>()
      );
    },
  };
};
