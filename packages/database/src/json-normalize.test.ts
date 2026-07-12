import { describe, expect, it } from 'vitest';

import { normalizeJsonStringArray, normalizeJsonValue } from './json-normalize.js';

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

describe('normalizeJsonValue', () => {
  it('parses object and array JSON strings', () => {
    expect(normalizeJsonValue('{"timestamp":1}')).toEqual({ timestamp: 1 });
    expect(normalizeJsonValue('[1,2]')).toEqual([1, 2]);
  });

  it('leaves non-JSON strings and objects unchanged', () => {
    expect(normalizeJsonValue('plain')).toBe('plain');
    expect(normalizeJsonValue({ a: 1 })).toEqual({ a: 1 });
    expect(normalizeJsonValue(null)).toBeNull();
  });
});
