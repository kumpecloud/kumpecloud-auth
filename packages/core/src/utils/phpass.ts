import crypto from 'node:crypto';

const itoa64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const md5Binary = (value: string) => crypto.createHash('md5').update(value, 'latin1').digest('latin1');

const encode64 = (input: string, count: number) => {
  let output = '';
  let index = 0;

  do {
    let value = input.charCodeAt(index++);
    output += itoa64[value & 0x3f];

    if (index < count) {
      value |= input.charCodeAt(index) << 8;
    }

    output += itoa64[(value >> 6) & 0x3f];

    if (index++ >= count) {
      break;
    }

    if (index < count) {
      value |= input.charCodeAt(index) << 16;
    }

    output += itoa64[(value >> 12) & 0x3f];

    if (index++ >= count) {
      break;
    }

    output += itoa64[(value >> 18) & 0x3f];
  } while (index < count);

  return output;
};

const cryptPrivate = (password: string, setting: string) => {
  let output = '*0';

  if (setting.slice(0, 2) === output) {
    output = '*1';
  }

  if (setting.slice(0, 3) !== '$P$' && setting.slice(0, 3) !== '$H$') {
    return output;
  }

  const countLog2 = itoa64.indexOf(setting[3] ?? '');

  if (countLog2 < 7 || countLog2 > 30) {
    return output;
  }

  let count = 1 << countLog2;
  const salt = setting.slice(4, 12);

  if (salt.length !== 8) {
    return output;
  }

  let hash = md5Binary(`${salt}${password}`);

  do {
    hash = md5Binary(`${hash}${password}`);
  } while (--count);

  return setting.slice(0, 12) + encode64(hash, 16);
};

export { isBcryptHash, isPhpassHash } from '@logto/shared/universal';

export const checkPhpassPassword = (password: string, storedHash: string) =>
  cryptPrivate(password, storedHash) === storedHash;
