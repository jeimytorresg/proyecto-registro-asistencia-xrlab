import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../src/app.setup';
import { AppModule } from '../src/app.module';

async function createApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });

  configureApp(app);
  await app.init();

  return app;
}

describe('API (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/health', () => {
    it('responde 200 con el envelope estándar y sin tocar la base de datos', async () => {
      const response = await request(app.getHttpServer()).get('/api/health').expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        data: { service: 'xrlab-api', status: 'healthy' },
        message: 'API XRLAB operativa',
      });
      expect(typeof response.body.data.timestamp).toBe('string');
      expect(response.body.requestId).toBe(response.headers['x-request-id']);
    });

    it('reenvía el X-Request-Id entrante', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .set('X-Request-Id', 'mi-request-id')
        .expect(200);

      expect(response.headers['x-request-id']).toBe('mi-request-id');
      expect(response.body.requestId).toBe('mi-request-id');
    });

    it('genera un request id nuevo si el entrante tiene caracteres no permitidos', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .set('X-Request-Id', 'a b<script>"')
        .expect(200);

      expect(response.headers['x-request-id']).not.toContain('<script>');
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('genera un request id nuevo si el entrante supera 80 caracteres', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .set('X-Request-Id', 'x'.repeat(81))
        .expect(200);

      expect(response.headers['x-request-id']).not.toBe('x'.repeat(81));
      expect(response.headers['x-request-id']).toBeTruthy();
    });
  });

  describe('rutas inexistentes', () => {
    it('responde 404 con el envelope de error', async () => {
      const response = await request(app.getHttpServer()).get('/api/nope').expect(404);

      expect(response.body).toMatchObject({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Ruta no encontrada: GET /api/nope' },
      });
      expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
    });
  });

  describe('cabeceras de seguridad', () => {
    it('aplica helmet y oculta x-powered-by', async () => {
      const response = await request(app.getHttpServer()).get('/api/health').expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('permite CORS solo a los orígenes configurados', async () => {
      const allowed = await request(app.getHttpServer())
        .get('/api/health')
        .set('Origin', 'http://allowed.test');
      const denied = await request(app.getHttpServer())
        .get('/api/health')
        .set('Origin', 'http://evil.test');

      expect(allowed.headers['access-control-allow-origin']).toBe('http://allowed.test');
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('auth (sin tocar la base de datos)', () => {
    it('GET /api/auth/session-check sin token responde 401 AUTH_REQUIRED', async () => {
      const response = await request(app.getHttpServer()).get('/api/auth/session-check').expect(401);

      expect(response.body).toMatchObject({ ok: false, error: { code: 'AUTH_REQUIRED' } });
    });

    it('GET /api/auth/admin-check con un JWT inventado responde 401 AUTH_INVALID_TOKEN', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/admin-check')
        .set('Authorization', 'Bearer no.es.un.jwt')
        .expect(401);

      expect(response.body).toMatchObject({ ok: false, error: { code: 'AUTH_INVALID_TOKEN' } });
    });

    it('POST /api/auth/login con body inválido responde 400 VALIDATION_ERROR', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'no-es-correo', password: '' })
        .expect(400);

      expect(response.body).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    });

    it('POST /api/auth/set-password rechaza contraseñas de menos de 10 caracteres', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/set-password')
        .send({ token: 'a'.repeat(43), password: 'corta' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('rate limit', () => {
    it('responde 429 con el envelope de error al superar el límite', async () => {
      const limitedApp = await createApp();

      try {
        const statuses: number[] = [];
        let lastBody: unknown;

        for (let attempt = 0; attempt < 25; attempt += 1) {
          const response = await request(limitedApp.getHttpServer()).get('/api/health');
          statuses.push(response.status);
          lastBody = response.body;
        }

        expect(statuses.slice(0, 20).every((status) => status === 200)).toBe(true);
        expect(statuses[statuses.length - 1]).toBe(429);
        expect(lastBody).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } });
      } finally {
        await limitedApp.close();
      }
    });
  });
});
