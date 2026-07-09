import { describe, expect, it } from 'vitest';

import { normalizeJsonStringArray } from './json-normalize.js';

describe('normalizeJsonStringArray', () => {
  it('passes through native arrays', () => {
    expect(normalizeJsonStringArray(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('parses JSON strings', () => {
    expect(normalizeJsonStringArray('["a","b"]')).toEqual(['a', 'b']);
  });

  it('returns empty array for invalid input', () => {
    expect(normalizeJsonStringArray(null)).toEqual([]);
    expect(normalizeJsonStringArray('not-json')).toEqual([]);
  });
});
