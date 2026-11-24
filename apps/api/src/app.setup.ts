import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { REQUEST_ID_HEADER, requestIdMiddleware } from './common/request-id.middleware';
import { ResponseEnvelopeInterceptor } from './common/response-envelope.interceptor';
import type { Env } from './config/env.schema';

const JSON_BODY_LIMIT = '300kb';
const CORS_PREFLIGHT_MAX_AGE_SECONDS = 600;

/**
 * Configuración global compartida por `main.ts` y los tests e2e, para que prueben la misma app.
 * La app debe crearse con `{ bodyParser: false }`: el parser JSON se registra aquí con su límite.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Detrás del proxy de Render, para que el rate limit use la IP real del cliente.
  if (config.get('NODE_ENV', { infer: true }) === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(requestIdMiddleware);
  app.use(helmet());
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', REQUEST_ID_HEADER],
    exposedHeaders: [REQUEST_ID_HEADER],
    maxAge: CORS_PREFLIGHT_MAX_AGE_SECONDS,
  });
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor(app.get(Reflector)));
}
