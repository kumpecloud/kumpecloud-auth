import { describe, expect, it } from 'vitest';

import { assertAMemberApiSuccess, parseAMemberEntityId } from './api-response.js';

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
});
