import { createMockQueryResult, sql } from '@silverhand/slonik';
import { describe, expect, it, vi } from 'vitest';

import { createPostgresPool, verifyPostgresPool } from './pool.js';

const { createPoolMock } = vi.hoisted(() => ({
  createPoolMock: vi.fn(),
}));

vi.mock('@silverhand/slonik', async (importOriginal) => {
  const original = await importOriginal<typeof import('@silverhand/slonik')>();

  return {
    ...original,
    createPool: createPoolMock,
  };
});

describe('createPostgresPool', () => {
  it('creates a mock pool when mockDatabaseConnection is true', async () => {
    const pool = await createPostgresPool('postgres://localhost/logto', {
      mockDatabaseConnection: true,
    });

    expect(pool).toBeDefined();
    expect(createPoolMock).not.toHaveBeenCalled();
  });

  it('delegates to Slonik createPool for real connections', async () => {
    const query = vi.fn().mockResolvedValue(createMockQueryResult([]));
    const slonikPool = { query, end: vi.fn() };
    createPoolMock.mockResolvedValueOnce(slonikPool);

    const pool = await createPostgresPool('postgres://user:pass@localhost:5432/logto', {
      statementTimeout: 30_000,
    });

    expect(createPoolMock).toHaveBeenCalledWith(
      'postgres://user:pass@localhost:5432/logto',
      expect.objectContaining({
        interceptors: expect.any(Array),
        statementTimeout: 30_000,
      })
    );
    expect(pool).toBe(slonikPool);
  });

  it('verifies pool readiness with select 1', async () => {
    const query = vi.fn().mockResolvedValue(createMockQueryResult([]));
    const slonikPool = { query, end: vi.fn(), transaction: vi.fn() };

    await expect(verifyPostgresPool(slonikPool as never)).resolves.toBe(slonikPool);
    expect(query).toHaveBeenCalled();
  });
});
