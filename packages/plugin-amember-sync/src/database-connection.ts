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

export type AMemberDatabaseStoredInput = {
  databaseHost?: string;
  databasePort?: number;
  databaseUser?: string;
  databasePassword?: string;
  databaseName?: string;
  databaseUrl?: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const normalizeDatabaseInput = (input: AMemberDatabaseStoredInput): AMemberDatabaseStoredInput => {
  const hasDiscreteConnection =
    isNonEmptyString(input.databaseHost) &&
    isNonEmptyString(input.databaseUser) &&
    isNonEmptyString(input.databaseName) &&
    isNonEmptyString(input.databasePassword);

  if (hasDiscreteConnection) {
    return {
      ...input,
      databasePort: input.databasePort ?? defaultDatabasePort,
    };
  }

  if (!input.databaseUrl) {
    return input;
  }

  const dsn = parseDsn(input.databaseUrl);

  return {
    ...input,
    databaseHost: input.databaseHost ?? dsn.host ?? undefined,
    databasePort: input.databasePort ?? dsn.port ?? defaultDatabasePort,
    databaseUser: input.databaseUser ?? dsn.username ?? undefined,
    databasePassword: input.databasePassword ?? dsn.password ?? undefined,
    databaseName: input.databaseName ?? dsn.databaseName ?? undefined,
  };
};

export const normalizeStoredDatabaseConfig = (
  config: AMemberSyncStoredConfig
): AMemberSyncStoredConfig => ({
  ...config,
  ...normalizeDatabaseInput(config),
});

export const resolveDatabaseConnectionFields = (
  input: AMemberDatabaseStoredInput
): AMemberDatabaseConnectionFields | undefined => {
  const normalized = normalizeDatabaseInput(input);

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

export const resolveDatabaseUrl = (input: AMemberDatabaseStoredInput): string | undefined => {
  const fields = resolveDatabaseConnectionFields(input);

  if (!fields) {
    return input.databaseUrl;
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

export const hasDatabaseConnection = (input: AMemberDatabaseStoredInput): boolean =>
  resolveDatabaseConnectionFields(input) !== undefined;
