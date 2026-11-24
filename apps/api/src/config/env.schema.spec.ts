import { validateEnv } from './env.schema';

const BASE_ENV = {
  DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5433/xrlab',
};

describe('validateEnv', () => {
  it('aplica valores por defecto cuando solo está DATABASE_URL', () => {
    const env = validateEnv(BASE_ENV);

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: BASE_ENV.DATABASE_URL,
      PG_POOL_MAX: 5,
      THROTTLE_TTL_MS: 60_000,
      THROTTLE_LIMIT: 100,
    });
    expect(env.CORS_ORIGINS).toEqual(['http://127.0.0.1:4300', 'http://localhost:4300']);
  });

  it('lanza un error que menciona DATABASE_URL cuando falta', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rechaza una DATABASE_URL que no es de Postgres', () => {
    expect(() => validateEnv({ DATABASE_URL: 'mysql://u:p@host/db' })).toThrow(/DATABASE_URL/);
  });

  it('convierte PORT y PG_POOL_MAX de texto a número', () => {
    const env = validateEnv({ ...BASE_ENV, PORT: '8080', PG_POOL_MAX: '10' });

    expect(env.PORT).toBe(8080);
    expect(env.PG_POOL_MAX).toBe(10);
  });

  it('rechaza un PG_POOL_MAX menor que 1', () => {
    expect(() => validateEnv({ ...BASE_ENV, PG_POOL_MAX: '0' })).toThrow(/PG_POOL_MAX/);
  });

  it('separa y recorta CORS_ORIGINS separados por coma', () => {
    const env = validateEnv({
      ...BASE_ENV,
      CORS_ORIGINS: ' https://a.example.com , https://b.example.com ,, ',
    });

    expect(env.CORS_ORIGINS).toEqual(['https://a.example.com', 'https://b.example.com']);
  });

  it('exige CORS_ORIGINS explícito en producción', () => {
    expect(() => validateEnv({ ...BASE_ENV, NODE_ENV: 'production' })).toThrow(/CORS_ORIGINS/);
  });

  it('acepta producción cuando CORS_ORIGINS está definido', () => {
    const env = validateEnv({
      ...BASE_ENV,
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://xrlab.example.com',
    });

    expect(env.NODE_ENV).toBe('production');
    expect(env.CORS_ORIGINS).toEqual(['https://xrlab.example.com']);
  });

  it('rechaza un NODE_ENV desconocido', () => {
    expect(() => validateEnv({ ...BASE_ENV, NODE_ENV: 'staging-x' })).toThrow(/NODE_ENV/);
  });
});
