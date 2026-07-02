import { describe, expect, it } from 'vitest';

import {
  assertAMemberApiSuccess,
  normalizeAMemberApiResponseBody,
  parseAMemberEntityId,
} from './api-response.js';

describe('normalizeAMemberApiResponseBody', () => {
  it('parses stringified JSON objects', () => {
    expect(normalizeAMemberApiResponseBody('{"user_id":12}')).toEqual({ user_id: 12 });
  });

  it('wraps numeric ids as user records', () => {
    expect(normalizeAMemberApiResponseBody(42)).toEqual({ user_id: 42 });
  });

  it('unwraps single-item arrays', () => {
    expect(normalizeAMemberApiResponseBody([{ user_id: 7 }])).toEqual({ user_id: 7 });
  });

  it('unwraps list-style _items payloads', () => {
    expect(normalizeAMemberApiResponseBody({ _items: [{ user_id: 9 }], _total: 1 })).toEqual({
      user_id: 9,
    });
  });

  it('wraps numeric string ids as user records', () => {
    expect(normalizeAMemberApiResponseBody('123')).toEqual({ user_id: 123 });
  });
});

describe('assertAMemberApiSuccess', () => {
  it('accepts successful entity payloads without an ok flag', () => {
    expect(() => {
      assertAMemberApiSuccess({ user_id: 12 }, 'create user');
    }).not.toThrow();
  });

  it('throws when aMember returns ok false', () => {
    expect(() => {
      assertAMemberApiSuccess(
        { ok: false, msg: 'Username or password is incorrect' },
        'check user'
      );
    }).toThrow('aMember API check user failed: Username or password is incorrect');
  });

  it('throws when aMember returns error true with message', () => {
    expect(() => {
      assertAMemberApiSuccess(
        {
          ok: false,
          error: true,
          message: 'API Error 10003 - no permissions for users-insert API call',
        },
        'create user'
      );
    }).toThrow('API Error 10003 - no permissions for users-insert API call');
  });

  it('throws when the response body is missing', () => {
    expect(() => {
      assertAMemberApiSuccess(undefined, 'create user');
    }).toThrow('aMember API returned no response body for create user');
  });

  it('throws with response details for non-object bodies', () => {
    expect(() => {
      assertAMemberApiSuccess('not-json', 'create user');
    }).toThrow('aMember API returned an unexpected response for create user: not-json');
  });
});

describe('parseAMemberEntityId', () => {
  it('parses user_id from a successful create response', () => {
    expect(parseAMemberEntityId({ user_id: 42 }, ['user_id', 'userId'], 'user', 'create user')).toBe(
      42
    );
  });

  it('throws when the create response omits an id', () => {
    expect(() => {
      parseAMemberEntityId({ ok: true }, ['user_id', 'userId'], 'user', 'create user');
    }).toThrow('aMember API create user did not return a user id');
  });

  it('parses ids from nested user records', () => {
    expect(
      parseAMemberEntityId({ user: { user_id: 55 } }, ['user_id', 'userId'], 'user', 'create user')
    ).toBe(55);
  });
});
