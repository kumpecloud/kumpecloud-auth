import { describe, expect, it } from 'vitest';

import {
  buildDatabaseUrl,
  defaultDatabasePort,
  normalizeStoredDatabaseConfig,
  resolveDatabaseConnectionFields,
  resolveDatabaseUrl,
  toDatabaseConnectionResponse,
} from './database-connection.js';

describe('database-connection', () => {
  it('parses legacy databaseUrl into discrete fields', () => {
    const normalized = normalizeStoredDatabaseConfig({
      enabled: false,
      databaseUrl: 'mysql://amember:secret@db.example.com:3307/amember_db',
    });

    expect(normalized).toEqual(
      expect.objectContaining({
        databaseHost: 'db.example.com',
        databasePort: 3307,
        databaseUser: 'amember',
        databasePassword: 'secret',
        databaseName: 'amember_db',
      })
    );
  });

  it('builds database URL from discrete fields', () => {
    const url = buildDatabaseUrl({
      databaseHost: 'localhost',
      databasePort: defaultDatabasePort,
      databaseUser: 'root',
      databasePassword: 'p@ss',
      databaseName: 'amember',
    });

    expect(resolveDatabaseConnectionFields({
      enabled: false,
      databaseUrl: url,
    })).toEqual(
      expect.objectContaining({
        databaseHost: 'localhost',
        databaseUser: 'root',
        databasePassword: 'p@ss',
        databaseName: 'amember',
      })
    );
  });

  it('exposes visible connection fields without the password', () => {
    expect(
      toDatabaseConnectionResponse({
        enabled: false,
        databaseHost: 'db.internal',
        databasePort: 3306,
        databaseUser: 'sync',
        databasePassword: 'hidden',
        databaseName: 'amember',
      })
    ).toEqual({
      databaseHost: 'db.internal',
      databasePort: 3306,
      databaseUser: 'sync',
      databaseName: 'amember',
      databasePasswordSet: true,
    });
  });

  it('prefers discrete fields over legacy databaseUrl', () => {
    expect(
      resolveDatabaseUrl({
        enabled: false,
        databaseHost: 'new-host',
        databasePort: 3306,
        databaseUser: 'user',
        databasePassword: 'pass',
        databaseName: 'amember',
        databaseUrl: 'mysql://old:old@legacy:3306/old',
      })
    ).toContain('new-host');
  });
});
