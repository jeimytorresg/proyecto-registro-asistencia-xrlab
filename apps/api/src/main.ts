import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  configureApp(app);
  app.enableShutdownHooks();

  const port = app.get<ConfigService<Env, true>>(ConfigService).get('PORT', { infer: true });

  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API XRLAB escuchando en el puerto ${port}`);
}

bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(
    'No se pudo iniciar la API',
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});
