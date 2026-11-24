import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ApiError } from './api-error';

/** Valida el body con un schema zod; si falla responde 400 `VALIDATION_ERROR` con el detalle por campo. */
@Injectable()
export class ZodBodyPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ');

    throw new ApiError(400, 'VALIDATION_ERROR', `Datos inválidos. ${details}`);
  }
}
