import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResponseMessage } from '../common/response-message.decorator';
import type { Env } from '../config/env.schema';

export interface HealthStatus {
  service: string;
  status: 'healthy';
  environment: Env['NODE_ENV'];
  timestamp: string;
}

/**
 * Health check para Render y el ping anti-sueño.
 * NO debe consultar la base de datos: mantendría despierto el cómputo de Neon y agotaría sus CU-horas.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService<Env, true>) {}

  @Get()
  @ResponseMessage('API XRLAB operativa')
  check(): HealthStatus {
    return {
      service: 'xrlab-api',
      status: 'healthy',
      environment: this.config.get('NODE_ENV', { infer: true }),
      timestamp: new Date().toISOString(),
    };
  }
}
