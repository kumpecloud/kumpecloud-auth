import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createPoolMock, queryMock, getConnectionMock, endMock } = vi.hoisted(() => {
  const query = vi.fn();
  const getConnection = vi.fn();
  const end = vi.fn();

  return {
    createPoolMock: vi.fn(),
    queryMock: query,
    getConnectionMock: getConnection,
    endMock: end,
  };
});

vi.mock('mysql2/promise', () => ({
  default: {
    createPool: createPoolMock,
  },
}));

const { createMariaPool, verifyMariaPool } = await import('./pool.js');

describe('createMariaPool', () => {
  beforeEach(() => {
    queryMock.mockReset();
    getConnectionMock.mockReset();
    endMock.mockReset();
    createPoolMock.mockReset();

    getConnectionMock.mockResolvedValue({
      query: queryMock,
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
    });
    endMock.mockResolvedValue(undefined);
    createPoolMock.mockReturnValue({ getConnection: getConnectionMock, end: endMock });
  });

  it('connects and runs a simple query', async () => {
    queryMock.mockResolvedValueOnce([[{ ok: 1 }], []]);

    const pool = await createMariaPool('mariadb://logto:pass@localhost:3306/logto');

    expect(createPoolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'localhost',
        port: 3306,
        database: 'logto',
        user: 'logto',
        password: 'pass',
      })
    );

    const result = await pool.query('SELECT 1');
    expect(result.rows).toEqual([{ ok: 1 }]);
  });

  it('verifies pool readiness with slonik token', async () => {
    queryMock.mockResolvedValueOnce([[{ ok: 1 }], []]);
    const pool = await createMariaPool('mariadb://localhost/logto');

    await expect(verifyMariaPool(pool)).resolves.toBe(pool);
    expect(queryMock).toHaveBeenCalledWith('select 1', []);
  });
});
