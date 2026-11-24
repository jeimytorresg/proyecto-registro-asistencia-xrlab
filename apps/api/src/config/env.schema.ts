import { z } from 'zod';

const DEV_CORS_ORIGINS: readonly string[] = ['http://127.0.0.1:4300', 'http://localhost:4300'];

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z
      .string({ error: 'DATABASE_URL es obligatoria' })
      .url('DATABASE_URL debe ser una URL válida')
      .refine((value) => /^postgres(ql)?:\/\//.test(value), 'DATABASE_URL debe ser una URL de Postgres'),
    PG_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
    CORS_ORIGINS: z.string().optional(),
    THROTTLE_TTL_MS: z.coerce.number().int().min(1).default(60_000),
    THROTTLE_LIMIT: z.coerce.number().int().min(1).default(100),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
    JWT_ACCESS_TTL_S: z.coerce.number().int().min(60).default(900),
    REFRESH_TTL_DAYS: z.coerce.number().int().min(1).default(30),
    AUTH_TOKEN_TTL_HOURS: z.coerce.number().int().min(1).default(48),
    APP_BASE_URL: z.string().url().default('http://localhost:4300'),
    RESEND_API_KEY: z.string().optional(),
    MAIL_FROM: z.string().default('XRLAB <onboarding@resend.dev>'),
  })
  .transform((raw, ctx) => {
    const configuredOrigins = (raw.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);

    if (raw.NODE_ENV === 'production' && configuredOrigins.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'CORS_ORIGINS es obligatorio en producción',
      });
      return z.NEVER;
    }

    if (raw.NODE_ENV === 'production' && !raw.RESEND_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'RESEND_API_KEY es obligatorio en producción',
      });
      return z.NEVER;
    }

    return {
      ...raw,
      CORS_ORIGINS: configuredOrigins.length > 0 ? configuredOrigins : [...DEV_CORS_ORIGINS],
    };
  });

export type Env = z.output<typeof envSchema>;

/**
 * Valida y normaliza las variables de entorno. Falla al arrancar con un mensaje legible, sin incluir
 * los valores recibidos (pueden ser secretos).
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('\n');

    throw new Error(`Variables de entorno inválidas:\n${details}`);
  }

  return result.data;
}
