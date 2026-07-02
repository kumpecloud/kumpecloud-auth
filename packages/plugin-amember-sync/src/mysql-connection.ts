import mysql from 'mysql2/promise';

import {
  resolveDatabaseConnectionFields,
  type AMemberDatabaseConnectionFields,
  type AMemberDatabaseStoredInput,
} from './database-connection.js';

export const defaultDatabaseConnectTimeoutMs = 10_000;

export class AMemberDatabaseConnectionError extends Error {
  readonly host: string;
  readonly port: number;

  constructor(message: string, host: string, port: number, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AMemberDatabaseConnectionError';
    this.host = host;
    this.port = port;
  }
}

const getMysqlErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return;
  }

  const { code } = error;

  return typeof code === 'string' ? code : undefined;
};

export const formatAMemberDatabaseConnectionError = (
  error: unknown,
  { databaseHost, databasePort }: Pick<AMemberDatabaseConnectionFields, 'databaseHost' | 'databasePort'>
): string => {
  const target = `${databaseHost}:${databasePort}`;
  const code = getMysqlErrorCode(error);

  switch (code) {
    case 'ETIMEDOUT': {
      return `Timed out connecting to aMember MySQL at ${target}. The auth service must be able to reach this host over the network. Do not use localhost unless MySQL runs in the same container. Check firewall rules, VPN/Nebula routing, and MySQL bind-address.`;
    }
    case 'ECONNREFUSED': {
      return `Connection refused by aMember MySQL at ${target}. Verify the host and port and that MySQL accepts remote connections.`;
    }
    case 'ENOTFOUND': {
      return `Could not resolve aMember MySQL host "${databaseHost}". Check the server address.`;
    }
    case 'ER_ACCESS_DENIED_ERROR': {
      return `Access denied for the configured MySQL user at ${target}. Check the username and password.`;
    }
    case 'ER_BAD_DB_ERROR': {
      return `The configured MySQL database is not available at ${target}. Check the database name and user permissions.`;
    }
    default: {
      break;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const resolveConnectionFields = (
  input: string | AMemberDatabaseStoredInput
): AMemberDatabaseConnectionFields => {
  const fields =
    typeof input === 'string'
      ? resolveDatabaseConnectionFields({ databaseUrl: input })
      : resolveDatabaseConnectionFields(input);

  if (!fields) {
    throw new Error(
      'MySQL connection settings are incomplete. Provide server address, username, password, and database name.'
    );
  }

  return fields;
};

export const connectAMemberDatabase = async (
  input: string | AMemberDatabaseStoredInput,
  { connectTimeout = defaultDatabaseConnectTimeoutMs }: { connectTimeout?: number } = {}
) => {
  const fields = resolveConnectionFields(input);

  try {
    return await mysql.createConnection({
      host: fields.databaseHost,
      port: fields.databasePort,
      user: fields.databaseUser,
      password: fields.databasePassword,
      database: fields.databaseName,
      connectTimeout,
    });
  } catch (error: unknown) {
    throw new AMemberDatabaseConnectionError(
      formatAMemberDatabaseConnectionError(error, fields),
      fields.databaseHost,
      fields.databasePort,
      { cause: error }
    );
  }
};

export const testAMemberDatabaseConnection = async (
  input: string | AMemberDatabaseStoredInput
): Promise<void> => {
  const connection = await connectAMemberDatabase(input);

  try {
    await connection.query('select 1');
  } finally {
    await connection.end();
  }
};
