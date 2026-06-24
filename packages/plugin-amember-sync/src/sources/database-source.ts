import mysql from 'mysql2/promise';

import type { AMemberAccess, AMemberProduct, AMemberUser } from '../types.js';
import type { AMemberDataSource } from '../context.js';
import { isTruthyFlag } from '../utils.js';

type DatabaseRow = Record<string, unknown>;

const toNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
};

const toString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : value === null || value === undefined ? undefined : String(value);

export const createDatabaseAMemberDataSource = ({
  databaseUrl,
  tablePrefix,
}: {
  databaseUrl: string;
  tablePrefix: string;
}): AMemberDataSource => {
  const prefix = tablePrefix.endsWith('_') ? tablePrefix : `${tablePrefix}_`;
  const productTable = `${prefix}product`;
  const userTable = `${prefix}user`;
  const accessTable = `${prefix}access`;

  const getConnection = async () => mysql.createConnection(databaseUrl);

  return {
    getProducts: async () => {
      const connection = await getConnection();

      try {
        const [rows] = await connection.query<DatabaseRow[]>(
          `select product_id, title, description from ${productTable}`
        );

        return rows
          .map((row) => {
            const productId = toNumber(row.product_id);
            const title = toString(row.title)?.trim();

            if (productId === undefined || !title) {
              return;
            }

            const description = toString(row.description)?.trim();

            return {
              productId,
              title,
              description: description || title,
            } satisfies AMemberProduct;
          })
          .filter((item): item is AMemberProduct => item !== undefined);
      } finally {
        await connection.end();
      }
    },
    getUsers: async () => {
      const connection = await getConnection();

      try {
        const [rows] = await connection.query<DatabaseRow[]>(
          `select user_id, login, email, pass, name_f, name_l, status, is_locked from ${userTable}`
        );

        return rows
          .map((row) => {
            const userId = toNumber(row.user_id);
            const login = toString(row.login)?.trim();

            if (userId === undefined || !login) {
              return;
            }

            const name = [toString(row.name_f), toString(row.name_l)].filter(Boolean).join(' ').trim();

            return {
              userId,
              login,
              email: toString(row.email)?.trim(),
              passwordHash: toString(row.pass)?.trim(),
              name: name || undefined,
              status: toNumber(row.status) ?? toString(row.status),
              isLocked: isTruthyFlag(row.is_locked),
            } satisfies AMemberUser;
          })
          .filter((item): item is AMemberUser => item !== undefined);
      } finally {
        await connection.end();
      }
    },
    getAccessRecords: async () => {
      const connection = await getConnection();

      try {
        const [rows] = await connection.query<DatabaseRow[]>(
          `select user_id, product_id, begin_date, expire_date from ${accessTable}`
        );

        return rows
          .map((row) => {
            const userId = toNumber(row.user_id);
            const productId = toNumber(row.product_id);

            if (userId === undefined || productId === undefined) {
              return;
            }

            return {
              userId,
              productId,
              beginDate: toString(row.begin_date),
              expireDate: toString(row.expire_date),
            } satisfies AMemberAccess;
          })
          .filter((item): item is AMemberAccess => item !== undefined);
      } finally {
        await connection.end();
      }
    },
  };
};
