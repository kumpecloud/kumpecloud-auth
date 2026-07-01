import nock from 'nock';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiAMemberDataSink } from './api-sink.js';

const apiUrl = 'https://billing.example.com/amember/api';
const apiKey = 'test-api-key';

afterEach(() => {
  nock.cleanAll();
});

describe('createApiAMemberDataSink', () => {
  it('creates a user when aMember returns user_id', async () => {
    nock('https://billing.example.com')
      .post('/amember/api/users', (body) => body.login === 'jane@example.com')
      .query({ _key: apiKey })
      .reply(200, { user_id: 99 });

    const sink = createApiAMemberDataSink({ apiUrl, apiKey });
    const userId = await sink.createUser({
      login: 'jane@example.com',
      email: 'jane@example.com',
    });

    expect(userId).toBe(99);
  });

  it('throws when aMember returns an API error payload', async () => {
    nock('https://billing.example.com')
      .post('/amember/api/users')
      .query({ _key: apiKey })
      .reply(200, {
        ok: false,
        error: true,
        message: 'API Error 10003 - no permissions for users-insert API call',
      });

    const sink = createApiAMemberDataSink({ apiUrl, apiKey });

    await expect(
      sink.createUser({
        login: 'jane@example.com',
        email: 'jane@example.com',
      })
    ).rejects.toThrow('API Error 10003 - no permissions for users-insert API call');
  });

  it('throws when aMember returns HTTP errors', async () => {
    nock('https://billing.example.com')
      .post('/amember/api/users')
      .query({ _key: apiKey })
      .reply(403, { ok: false, message: 'Forbidden' });

    const sink = createApiAMemberDataSink({ apiUrl, apiKey });

    await expect(
      sink.createUser({
        login: 'jane@example.com',
      })
    ).rejects.toThrow('aMember API create user failed: Forbidden');
  });

  it('throws when update user returns an API error payload', async () => {
    nock('https://billing.example.com')
      .post('/amember/api/users/12')
      .query({ _key: apiKey, _method: 'PUT' })
      .reply(200, { ok: false, message: 'User not found' });

    const sink = createApiAMemberDataSink({ apiUrl, apiKey });

    await expect(sink.updateUser(12, { email: 'new@example.com' })).rejects.toThrow(
      'aMember API update user failed: User not found'
    );
  });
});
