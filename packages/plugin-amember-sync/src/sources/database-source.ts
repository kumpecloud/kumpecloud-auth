import mysql from 'mysql2/promise';

import type { AMemberAccess, AMemberProduct, AMemberUser } from '../types.js';
import type { AMemberDataSource } from '../context.js';
import { connectAMemberDatabase } from '../mysql-connection.js';
import { parseAMemberUserProfileFields, resolveDatabaseUserSelectColumns } from '../profile-fields.js';
import { buildAMemberUserName, normalizeAMemberDateString } from '../utils.js';

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

  const getConnection = async () => connectAMemberDatabase(databaseUrl);

  let cachedUserSelectColumns: string[] | undefined;

  const getUserSelectColumns = async (connection: mysql.Connection) => {
    if (cachedUserSelectColumns) {
      return cachedUserSelectColumns;
    }

    const [columnRows] = await connection.query<DatabaseRow[]>(`show columns from ${userTable}`);
    const availableColumns = new Set(columnRows.map((row) => String(row.Field)));
    cachedUserSelectColumns = resolveDatabaseUserSelectColumns(availableColumns);

    return cachedUserSelectColumns;
  };

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
        const columns = await getUserSelectColumns(connection);
        const [rows] = await connection.query<DatabaseRow[]>(
          `select ${columns.join(', ')} from ${userTable}`
        );

        return rows
          .map((row) => {
            const userId = toNumber(row.user_id);
            const login = toString(row.login)?.trim();

            if (userId === undefined || !login) {
              return;
            }

            const profile = parseAMemberUserProfileFields(row);

            return {
              userId,
              login,
              email: toString(row.email)?.trim(),
              cryptPass: toString(row.crypt_pass)?.trim(),
              mobileAreaCode: toString(row.mobile_area_code)?.trim(),
              mobileNumber: toString(row.mobile_number)?.trim(),
              name: buildAMemberUserName(profile.nameF, profile.nameL),
              ...profile,
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
              beginDate: normalizeAMemberDateString(row.begin_date),
              expireDate: normalizeAMemberDateString(row.expire_date),
            } satisfies AMemberAccess;
          })
          .filter((item): item is AMemberAccess => item !== undefined);
      } finally {
        await connection.end();
      }
    },
  };
};
