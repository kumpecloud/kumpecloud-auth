import crypto from 'node:crypto';

import { isCryptMd5Hash } from '@logto/shared/universal';

export { isCryptMd5Hash } from '@logto/shared/universal';

const itoa64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const to64 = (index: number, count: number) => {
  let result = '';
  let value = index;

  while (--count >= 0) {
    result += itoa64[value & 63];
    value >>= 6;
  }

  return result;
};

const getSalt = (inputSalt?: string) => {
  if (inputSalt) {
    return inputSalt.split('$')[2] ?? '';
  }

  let salt = '';

  while (salt.length < 8) {
    salt += itoa64[Math.floor(Math.random() * 64)];
  }

  return salt;
};

const getPassword = (final: string) => {
  let epass = '';

  epass += to64(
    (final.charCodeAt(0) << 16) | (final.charCodeAt(6) << 8) | final.charCodeAt(12),
    4
  );
  epass += to64(
    (final.charCodeAt(1) << 16) | (final.charCodeAt(7) << 8) | final.charCodeAt(13),
    4
  );
  epass += to64(
    (final.charCodeAt(2) << 16) | (final.charCodeAt(8) << 8) | final.charCodeAt(14),
    4
  );
  epass += to64(
    (final.charCodeAt(3) << 16) | (final.charCodeAt(9) << 8) | final.charCodeAt(15),
    4
  );
  epass += to64(
    (final.charCodeAt(4) << 16) | (final.charCodeAt(10) << 8) | final.charCodeAt(5),
    4
  );
  epass += to64(final.charCodeAt(11), 2);

  return epass;
};

/** Unix MD5 crypt ($1$) hash compatible with PHP password_verify/crypt. */
export const hashCryptMd5 = (password: string, salt?: string) => {
  const magic = salt?.split('$')[1] === '1' ? '$1$' : '$apr1$';
  const normalizedSalt = getSalt(salt);

  let ctx = password + magic + normalizedSalt;
  let final = crypto
    .createHash('md5')
    .update(password + normalizedSalt + password, 'latin1')
    .digest('latin1');

  for (let passwordLength = password.length; passwordLength > 0; passwordLength -= 16) {
    ctx += final.slice(0, passwordLength > 16 ? 16 : passwordLength);
  }

  for (let index = password.length; index; index >>= 1) {
    ctx += index % 2 ? String.fromCharCode(0) : password.charAt(0);
  }

  final = crypto.createHash('md5').update(ctx, 'latin1').digest('latin1');

  for (let index = 0; index < 1000; ++index) {
    let ctxLoop = '';

    if (index % 2) {
      ctxLoop += password;
    } else {
      ctxLoop += final.slice(0, 16);
    }

    if (index % 3) {
      ctxLoop += normalizedSalt;
    }

    if (index % 7) {
      ctxLoop += password;
    }

    if (index % 2) {
      ctxLoop += final.slice(0, 16);
    } else {
      ctxLoop += password;
    }

    final = crypto.createHash('md5').update(ctxLoop, 'latin1').digest('latin1');
  }

  return `${magic}${normalizedSalt}$${getPassword(final)}`;
};

export const checkCryptMd5Password = (password: string, storedHash: string) =>
  hashCryptMd5(password, storedHash) === storedHash;
