import { describe, expect, it } from 'vitest';

import { checkCryptMd5Password, hashCryptMd5 } from './crypt-md5.js';
import { isCryptMd5Hash } from '@logto/shared/universal';

describe('crypt-md5', () => {
  it('detects unix md5 crypt hashes', () => {
    expect(isCryptMd5Hash('$1$Z9lyfh18$8211iUtJxjhYUSmKmmCNS/')).toBe(true);
    expect(isCryptMd5Hash('$P$Ba8vv/yagKHIyocKZBku1Z60QwfJdf.')).toBe(false);
  });

  it('verifies generated hashes', () => {
    const password = 'secret123';
    const hash = hashCryptMd5(password, '$1$testsalt$');

    expect(checkCryptMd5Password(password, hash)).toBe(true);
    expect(checkCryptMd5Password('wrong-password', hash)).toBe(false);
  });
});
