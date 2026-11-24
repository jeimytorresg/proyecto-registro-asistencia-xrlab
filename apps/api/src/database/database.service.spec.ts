import type { Pool, PoolClient } from 'pg';
import { DatabaseService } from './database.service';

interface FakePool {
  query: jest.Mock;
  connect: jest.Mock;
  end: jest.Mock;
}

function buildPool(): FakePool {
  return { query: jest.fn(), connect: jest.fn(), end: jest.fn().mockResolvedValue(undefined) };
}

function buildService(pool: FakePool): DatabaseService {
  return new DatabaseService(pool as unknown as Pool);
}

const OK_RESULT = { rows: [{ id: 1 }], rowCount: 1 };

describe('DatabaseService.query', () => {
  it('delega en el pool y devuelve el resultado', async () => {
    const pool = buildPool();
    pool.query.mockResolvedValue(OK_RESULT);

    const result = await buildService(pool).query('select 1 where $1', [true]);

    expect(result).toBe(OK_RESULT);
    expect(pool.query).toHaveBeenCalledWith('select 1 where $1', [true]);
  });

  it('reintenta una vez cuando la conexión no se pudo establecer a tiempo', async () => {
    const pool = buildPool();
    pool.query
      .mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'))
      .mockResolvedValueOnce(OK_RESULT);

    const result = await buildService(pool).query('select 1');

    expect(result).toBe(OK_RESULT);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('también reintenta con el error de timeout del cliente', async () => {
    const pool = buildPool();
    pool.query
      .mockRejectedValueOnce(new Error('Connection terminated due to connection timeout'))
      .mockResolvedValueOnce(OK_RESULT);

    await buildService(pool).query('select 1');

    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('se rinde tras un solo reintento', async () => {
    const pool = buildPool();
    const failure = new Error('timeout exceeded when trying to connect');
    pool.query.mockRejectedValue(failure);

    await expect(buildService(pool).query('select 1')).rejects.toBe(failure);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('NO reintenta "Connection terminated unexpectedly" (puede haber ejecutado la consulta)', async () => {
    const pool = buildPool();
    pool.query.mockRejectedValue(new Error('Connection terminated unexpectedly'));

    await expect(buildService(pool).query('insert into t values (1)')).rejects.toThrow(
      'Connection terminated unexpectedly',
    );
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('NO reintenta errores SQL', async () => {
    const pool = buildPool();
    pool.query.mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505' }));

    await expect(buildService(pool).query('insert into t values (1)')).rejects.toThrow(
      'duplicate key',
    );
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

describe('DatabaseService.withTransaction', () => {
  function buildClient(): { client: PoolClient; query: jest.Mock; release: jest.Mock } {
    const query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const release = jest.fn();

    return { client: { query, release } as unknown as PoolClient, query, release };
  }

  it('hace BEGIN, ejecuta la función, COMMIT y libera el cliente', async () => {
    const pool = buildPool();
    const { client, query, release } = buildClient();
    pool.connect.mockResolvedValue(client);

    const result = await buildService(pool).withTransaction(async (tx) => {
      await tx.query('update t set a = 1');
      return 'listo';
    });

    expect(result).toBe('listo');
    expect(query.mock.calls.map((call) => call[0])).toEqual(['BEGIN', 'update t set a = 1', 'COMMIT']);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('hace ROLLBACK, relanza el error original y libera el cliente', async () => {
    const pool = buildPool();
    const { client, query, release } = buildClient();
    pool.connect.mockResolvedValue(client);
    const failure = new Error('falló la regla de negocio');

    await expect(
      buildService(pool).withTransaction(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(query.mock.calls.map((call) => call[0])).toEqual(['BEGIN', 'ROLLBACK']);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('no enmascara el error original si el ROLLBACK también falla', async () => {
    const pool = buildPool();
    const { client, query, release } = buildClient();
    query.mockImplementation(async (sql: string) => {
      if (sql === 'ROLLBACK') {
        throw new Error('rollback roto');
      }
      return { rows: [], rowCount: 0 };
    });
    pool.connect.mockResolvedValue(client);
    const failure = new Error('error original');

    await expect(
      buildService(pool).withTransaction(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    // Con el ROLLBACK roto se descarta la conexión (release con error) en lugar de reutilizarla.
    expect(release).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('DatabaseService lifecycle', () => {
  it('cierra el pool al destruir el módulo', async () => {
    const pool = buildPool();

    await buildService(pool).onModuleDestroy();

    expect(pool.end).toHaveBeenCalledTimes(1);
  });
});
