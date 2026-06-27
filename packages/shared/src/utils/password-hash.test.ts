import { describe, expect, it } from 'vitest';

import {
  isBcryptHash,
  isCryptMd5Hash,
  isPhpassHash,
  normalizeBcryptHash,
} from './password-hash.js';

describe('password-hash helpers', () => {
  it('detects supported hash formats', () => {
    expect(isPhpassHash('$P$Ba8vv/yagKHIyocKZBku1Z60QwfJdf.')).toBe(true);
    expect(
      isBcryptHash('$2a$12$WQMqTfbtcZFBC1C1u8wpie6lXOSciUr5kk/8yEydoIMKltb9UKJ.6')
    ).toBe(true);
    expect(isCryptMd5Hash('$1$Z9lyfh18$8211iUtJxjhYUSmKmmCNS/')).toBe(true);
  });

  it('normalizes php bcrypt hashes to node-compatible prefixes', () => {
    expect(normalizeBcryptHash('$2y$10$abcdefghijklmnopqrstuv')).toBe(
      '$2a$10$abcdefghijklmnopqrstuv'
    );
  });
});
