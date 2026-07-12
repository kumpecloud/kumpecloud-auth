import { DatabaseDialect, getDatabaseDialectFromUrl } from '../dialect.js';
import type { QueryDialect } from '../types.js';
import { mariaQueryDialect } from './mariadb.js';
import { postgresQueryDialect } from './postgres.js';

export const getQueryDialect = (dialect: DatabaseDialect): QueryDialect => {
  switch (dialect) {
    case DatabaseDialect.MariaDB: {
      return mariaQueryDialect;
    }
    default: {
      return postgresQueryDialect;
    }
  }
};

export const getQueryDialectFromUrl = (databaseUrl: string): QueryDialect =>
  getQueryDialect(getDatabaseDialectFromUrl(databaseUrl));

export { mariaQueryDialect, postgresQueryDialect };
