import type { z } from 'zod';
import { ApiError } from './api-error.js';

/** Valida el cuerpo de la petición con zod y responde 400 VALIDATION_ERROR si no cumple. */
export function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      parsed.error.issues.map((issue) => issue.message).join('; '),
    );
  }

  return parsed.data;
}
