import { describe, expect, it } from 'vitest';

import { mariaQueryDialect } from './mariadb.js';
import { postgresQueryDialect } from './postgres.js';

describe('query dialect regex operators', () => {
  it('honors case sensitivity on MariaDB Posix regex', () => {
    expect(String(mariaQueryDialect.buildRegexOperator(true).sql)).toContain('REGEXP BINARY');
    expect(String(mariaQueryDialect.buildRegexOperator(false).sql)).toBe('REGEXP');
  });

  it('uses case-sensitive similar-to on MariaDB', () => {
    expect(String(mariaQueryDialect.buildSimilarToOperator().sql)).toBe('REGEXP BINARY');
  });

  it('keeps Postgres case-sensitive Posix regex distinct from case-insensitive', () => {
    expect(String(postgresQueryDialect.buildRegexOperator(true).sql)).toBe('~');
    expect(String(postgresQueryDialect.buildRegexOperator(false).sql)).toBe('~*');
  });
});
