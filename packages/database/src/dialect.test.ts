import { describe, expect, it } from 'vitest';

import { DatabaseDialect, getDatabaseDialectFromUrl, parseDatabaseUrl } from './dialect.js';

describe('parseDatabaseUrl', () => {
  it('parses postgres:// URLs', () => {
    const result = parseDatabaseUrl('postgres://user:pass@localhost:5432/logto');

    expect(result).toEqual({
      dialect: DatabaseDialect.Postgres,
      url: 'postgres://user:pass@localhost:5432/logto',
      hostname: 'localhost',
      port: 5432,
      database: 'logto',
      username: 'user',
      password: 'pass',
    });
  });

  it('parses postgresql:// URLs', () => {
    expect(parseDatabaseUrl('postgresql://localhost/logto').dialect).toBe(DatabaseDialect.Postgres);
  });

  it('parses mariadb:// URLs', () => {
    const result = parseDatabaseUrl('mariadb://logto:secret@db.example.com:3307/mydb');

    expect(result).toEqual({
      dialect: DatabaseDialect.MariaDB,
      url: 'mariadb://logto:secret@db.example.com:3307/mydb',
      hostname: 'db.example.com',
      port: 3307,
      database: 'mydb',
      username: 'logto',
      password: 'secret',
    });
  });

  it('parses mysql:// URLs as MariaDB dialect', () => {
    expect(parseDatabaseUrl('mysql://root@localhost/app').dialect).toBe(DatabaseDialect.MariaDB);
  });

  it('defaults port when omitted', () => {
    expect(parseDatabaseUrl('postgres://localhost/logto').port).toBe(5432);
    expect(parseDatabaseUrl('mariadb://localhost/logto').port).toBe(3306);
  });

  it('throws on missing database name', () => {
    expect(() => parseDatabaseUrl('postgres://localhost/')).toThrow(/Database name/);
  });

  it('throws on unsupported protocol', () => {
    expect(() => parseDatabaseUrl('sqlite:///tmp/logto.db')).toThrow(/Unsupported database URL/);
  });
});

describe('getDatabaseDialectFromUrl', () => {
  it('detects MariaDB without requiring a valid database path', () => {
    expect(getDatabaseDialectFromUrl('mariadb://localhost/')).toBe(DatabaseDialect.MariaDB);
  });

  it('defaults to Postgres for empty URLs', () => {
    expect(getDatabaseDialectFromUrl('')).toBe(DatabaseDialect.Postgres);
  });
});
