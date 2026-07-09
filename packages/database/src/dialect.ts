export enum DatabaseDialect {
  Postgres = 'postgres',
  MariaDB = 'mariadb',
}

const postgresProtocols = new Set(['postgres:', 'postgresql:']);
const mariaProtocols = new Set(['mariadb:', 'mysql:']);

export type ParsedDatabaseUrl = {
  dialect: DatabaseDialect;
  url: string;
  hostname: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
};

export const parseDatabaseUrl = (rawUrl: string): ParsedDatabaseUrl => {
  const url = rawUrl.trim();

  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new TypeError(`Invalid database URL: ${url}`);
  }

  const dialect = (() => {
    if (postgresProtocols.has(parsed.protocol)) {
      return DatabaseDialect.Postgres;
    }

    if (mariaProtocols.has(parsed.protocol)) {
      return DatabaseDialect.MariaDB;
    }

    throw new TypeError(
      `Unsupported database URL protocol "${parsed.protocol}". Use postgres://, postgresql://, mariadb://, or mysql://.`
    );
  })();

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));

  if (!database) {
    throw new TypeError('Database name is required in URL path');
  }

  const port =
    parsed.port === ''
      ? dialect === DatabaseDialect.MariaDB
        ? 3306
        : 5432
      : Number(parsed.port);

  return {
    dialect,
    url,
    hostname: parsed.hostname,
    port,
    database,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
  };
};

export const isMariaDatabaseDialect = (dialect: DatabaseDialect): boolean =>
  dialect === DatabaseDialect.MariaDB;

export const isPostgresDatabaseDialect = (dialect: DatabaseDialect): boolean =>
  dialect === DatabaseDialect.Postgres;

export const getDatabaseDialectFromUrl = (databaseUrl: string): DatabaseDialect => {
  try {
    const parsed = new URL(databaseUrl.trim());

    if (mariaProtocols.has(parsed.protocol)) {
      return DatabaseDialect.MariaDB;
    }
  } catch {
    // Fall through to Postgres default for empty/invalid URLs in unit tests.
  }

  return DatabaseDialect.Postgres;
};
