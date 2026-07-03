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

  const mapProductRow = (row: DatabaseRow): AMemberProduct | undefined => {
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
    };
  };

  const mapUserRow = (row: DatabaseRow): AMemberUser | undefined => {
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
    };
  };

  const mapAccessRow = (row: DatabaseRow): AMemberAccess | undefined => {
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
    };
  };

  return {
    getProducts: async () => {
      const connection = await getConnection();

      try {
        const [rows] = await connection.query<DatabaseRow[]>(
          `select product_id, title, description from ${productTable}`
        );

        return rows
          .map((row) => mapProductRow(row))
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
          .map((row) => mapUserRow(row))
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
          .map((row) => mapAccessRow(row))
          .filter((item): item is AMemberAccess => item !== undefined);
      } finally {
        await connection.end();
      }
    },
    getUserById: async (userId) => {
      const connection = await getConnection();

      try {
        const columns = await getUserSelectColumns(connection);
        const [rows] = await connection.query<DatabaseRow[]>(
          `select ${columns.join(', ')} from ${userTable} where user_id = ?`,
          [userId]
        );

        return mapUserRow(rows[0] ?? {});
      } finally {
        await connection.end();
      }
    },
    findUserByLoginOrEmail: async ({ login, email }) => {
      const connection = await getConnection();

      try {
        const columns = await getUserSelectColumns(connection);

        if (login?.trim()) {
          const [rows] = await connection.query<DatabaseRow[]>(
            `select ${columns.join(', ')} from ${userTable} where login = ? limit 1`,
            [login.trim()]
          );
          const user = mapUserRow(rows[0] ?? {});

          if (user) {
            return user;
          }
        }

        if (email?.trim()) {
          const [rows] = await connection.query<DatabaseRow[]>(
            `select ${columns.join(', ')} from ${userTable} where email = ? limit 1`,
            [email.trim()]
          );

          return mapUserRow(rows[0] ?? {});
        }
      } finally {
        await connection.end();
      }
    },
    getAccessRecordsForUser: async (userId) => {
      const connection = await getConnection();

      try {
        const [rows] = await connection.query<DatabaseRow[]>(
          `select user_id, product_id, begin_date, expire_date from ${accessTable} where user_id = ?`,
          [userId]
        );

        return rows
          .map((row) => mapAccessRow(row))
          .filter((item): item is AMemberAccess => item !== undefined);
      } finally {
        await connection.end();
      }
    },
    getProductsByIds: async (productIds) => {
      if (productIds.length === 0) {
        return [];
      }

      const connection = await getConnection();

      try {
        const placeholders = productIds.map(() => '?').join(', ');
        const [rows] = await connection.query<DatabaseRow[]>(
          `select product_id, title, description from ${productTable} where product_id in (${placeholders})`,
          productIds
        );

        return rows
          .map((row) => mapProductRow(row))
          .filter((item): item is AMemberProduct => item !== undefined);
      } finally {
        await connection.end();
      }
    },
  };
};
