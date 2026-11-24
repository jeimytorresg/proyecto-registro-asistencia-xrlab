import { z } from 'zod';

const DEV_CORS_ORIGINS: readonly string[] = ['http://127.0.0.1:4300', 'http://localhost:4300'];

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z
      .string({ required_error: 'DATABASE_URL es obligatoria' })
      .url('DATABASE_URL debe ser una URL válida')
      .refine((value) => /^postgres(ql)?:\/\//.test(value), 'DATABASE_URL debe ser una URL de Postgres'),
    PG_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
    CORS_ORIGINS: z.string().optional(),
    THROTTLE_TTL_MS: z.coerce.number().int().min(1).default(60_000),
    THROTTLE_LIMIT: z.coerce.number().int().min(1).default(100),
  })
  .transform((raw, ctx) => {
    const configuredOrigins = (raw.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);

    if (raw.NODE_ENV === 'production' && configuredOrigins.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message: 'CORS_ORIGINS es obligatorio en producción',
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
