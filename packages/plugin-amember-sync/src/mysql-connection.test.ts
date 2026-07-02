import { describe, expect, it } from 'vitest';

import { formatAMemberDatabaseConnectionError } from './mysql-connection.js';

describe('formatAMemberDatabaseConnectionError()', () => {
  const target = { databaseHost: 'db.example.com', databasePort: 3306 };

  it('explains ETIMEDOUT with networking guidance', () => {
    expect(formatAMemberDatabaseConnectionError({ code: 'ETIMEDOUT' }, target)).toContain(
      'Timed out connecting to aMember MySQL at db.example.com:3306'
    );
  });

  it('explains ECONNREFUSED', () => {
    expect(formatAMemberDatabaseConnectionError({ code: 'ECONNREFUSED' }, target)).toContain(
      'Connection refused'
    );
  });

  it('falls back to the original error message', () => {
    expect(formatAMemberDatabaseConnectionError(new Error('boom'), target)).toBe('boom');
  });
});
