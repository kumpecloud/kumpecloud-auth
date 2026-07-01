import type { AMemberSyncStoredConfig } from '@logto/schemas';
import { parseDsn, stringifyDsn } from '@silverhand/slonik';

export const defaultDatabasePort = 3306;

export type AMemberDatabaseConnectionFields = {
  databaseHost: string;
  databasePort: number;
  databaseUser: string;
  databasePassword: string;
  databaseName: string;
};

export type AMemberDatabaseConnectionResponse = {
  databaseHost?: string;
  databasePort: number;
  databaseUser?: string;
  databaseName?: string;
  databasePasswordSet: boolean;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

export const normalizeStoredDatabaseConfig = (
  config: AMemberSyncStoredConfig
): AMemberSyncStoredConfig => {
  const hasDiscreteConnection =
    isNonEmptyString(config.databaseHost) &&
    isNonEmptyString(config.databaseUser) &&
    isNonEmptyString(config.databaseName) &&
    isNonEmptyString(config.databasePassword);

  if (hasDiscreteConnection) {
    return {
      ...config,
      databasePort: config.databasePort ?? defaultDatabasePort,
    };
  }

  if (!config.databaseUrl) {
    return config;
  }

  const dsn = parseDsn(config.databaseUrl);

  return {
    ...config,
    databaseHost: config.databaseHost ?? dsn.host ?? undefined,
    databasePort: config.databasePort ?? dsn.port ?? defaultDatabasePort,
    databaseUser: config.databaseUser ?? dsn.username ?? undefined,
    databasePassword: config.databasePassword ?? dsn.password ?? undefined,
    databaseName: config.databaseName ?? dsn.databaseName ?? undefined,
  };
};

export const resolveDatabaseConnectionFields = (
  config: AMemberSyncStoredConfig
): AMemberDatabaseConnectionFields | undefined => {
  const normalized = normalizeStoredDatabaseConfig(config);

  if (
    !isNonEmptyString(normalized.databaseHost) ||
    !isNonEmptyString(normalized.databaseUser) ||
    !isNonEmptyString(normalized.databasePassword) ||
    !isNonEmptyString(normalized.databaseName)
  ) {
    return;
  }

  return {
    databaseHost: normalized.databaseHost,
    databasePort: normalized.databasePort ?? defaultDatabasePort,
    databaseUser: normalized.databaseUser,
    databasePassword: normalized.databasePassword,
    databaseName: normalized.databaseName,
  };
};

export const resolveDatabaseUrl = (config: AMemberSyncStoredConfig): string | undefined => {
  const fields = resolveDatabaseConnectionFields(config);

  if (!fields) {
    return config.databaseUrl;
  }

  return buildDatabaseUrl(fields);
};

export const buildDatabaseUrl = ({
  databaseHost,
  databasePort,
  databaseUser,
  databasePassword,
  databaseName,
}: AMemberDatabaseConnectionFields): string =>
  stringifyDsn({
    host: databaseHost,
    port: databasePort,
    username: databaseUser,
    password: databasePassword,
    databaseName,
  });

export const toDatabaseConnectionResponse = (
  config: AMemberSyncStoredConfig
): AMemberDatabaseConnectionResponse => {
  const normalized = normalizeStoredDatabaseConfig(config);

  return {
    databaseHost: normalized.databaseHost,
    databasePort: normalized.databasePort ?? defaultDatabasePort,
    databaseUser: normalized.databaseUser,
    databaseName: normalized.databaseName,
    databasePasswordSet: Boolean(normalized.databasePassword),
  };
};

export const hasDatabaseConnection = (config: AMemberSyncStoredConfig): boolean =>
  resolveDatabaseConnectionFields(config) !== undefined;
