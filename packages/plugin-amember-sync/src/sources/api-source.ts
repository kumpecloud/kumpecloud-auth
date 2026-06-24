import got from 'got';

import type { AMemberAccess, AMemberProduct, AMemberUser } from '../types.js';
import type { AMemberDataSource } from '../context.js';
import { isTruthyFlag } from '../utils.js';

type ApiListResponse<T> = {
  _total?: number;
  _page?: number;
  _items?: T[];
};

type RawProduct = {
  product_id?: number;
  productId?: number;
  title?: string;
  description?: string;
};

type RawUser = {
  user_id?: number;
  userId?: number;
  login?: string;
  email?: string;
  pass?: string;
  name_f?: string;
  name_l?: string;
  status?: number | string;
  is_locked?: number | string | boolean;
  isLocked?: number | string | boolean;
  deleted?: number | string | boolean;
  is_deleted?: number | string | boolean;
};

type RawAccess = {
  user_id?: number;
  userId?: number;
  product_id?: number;
  productId?: number;
  begin_date?: string;
  beginDate?: string;
  expire_date?: string;
  expireDate?: string;
};

const pageSize = 1000;

const toNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
};

const mapProduct = (raw: RawProduct): AMemberProduct | undefined => {
  const productId = toNumber(raw.product_id ?? raw.productId);
  const title = raw.title?.trim();

  if (productId === undefined || !title) {
    return;
  }

  return {
    productId,
    title,
    description: raw.description?.trim() || title,
  };
};

const mapUser = (raw: RawUser): AMemberUser | undefined => {
  const userId = toNumber(raw.user_id ?? raw.userId);
  const login = raw.login?.trim();

  if (userId === undefined || !login) {
    return;
  }

  const name = [raw.name_f, raw.name_l].filter(Boolean).join(' ').trim();

  return {
    userId,
    login,
    email: raw.email?.trim(),
    passwordHash: raw.pass?.trim(),
    name: name || undefined,
    status: raw.status,
    isLocked: isTruthyFlag(raw.is_locked ?? raw.isLocked),
    isDeleted: isTruthyFlag(raw.deleted ?? raw.is_deleted),
  };
};

const mapAccess = (raw: RawAccess): AMemberAccess | undefined => {
  const userId = toNumber(raw.user_id ?? raw.userId);
  const productId = toNumber(raw.product_id ?? raw.productId);

  if (userId === undefined || productId === undefined) {
    return;
  }

  return {
    userId,
    productId,
    beginDate: raw.begin_date ?? raw.beginDate,
    expireDate: raw.expire_date ?? raw.expireDate,
  };
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

export const createApiAMemberDataSource = ({
  apiUrl,
  apiKey,
}: {
  apiUrl: string;
  apiKey: string;
}): AMemberDataSource => {
  const client = got.extend({
    prefixUrl: apiUrl.replace(/\/$/u, ''),
    searchParams: { _key: apiKey },
    responseType: 'json',
    retry: { limit: 2 },
  });

  const fetchAllPages = async <T>(endpoint: string): Promise<T[]> => {
    const items: T[] = [];
    let page = 0;
    let total = Number.POSITIVE_INFINITY;

    while (page * pageSize < total) {
      const body = await client.get(endpoint, {
        searchParams: {
          _key: apiKey,
          count: pageSize,
          page,
        },
      }).json<unknown>();

      const pageItems = extractItems<T>(body);
      items.push(...pageItems);

      if (body && typeof body === 'object' && '_total' in body) {
        total = Number((body as ApiListResponse<T>)._total ?? pageItems.length);
      } else if (pageItems.length < pageSize) {
        break;
      }

      page += 1;
    }

    return items;
  };

  return {
    getProducts: async () => {
      const items = await fetchAllPages<RawProduct>('products');

      return items
        .map((item) => mapProduct(item))
        .filter((item): item is AMemberProduct => item !== undefined);
    },
    getUsers: async () => {
      const items = await fetchAllPages<RawUser>('users');

      return items
        .map((item) => mapUser(item))
        .filter((item): item is AMemberUser => item !== undefined);
    },
    getAccessRecords: async () => {
      const items = await fetchAllPages<RawAccess>('access');

      return items
        .map((item) => mapAccess(item))
        .filter((item): item is AMemberAccess => item !== undefined);
    },
  };
};
