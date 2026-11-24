import { HttpException } from '@nestjs/common';

/**
 * Error de dominio con código estable para el frontend (p. ej. `ROLE_FORBIDDEN`, `NOT_FOUND`).
 * Mantiene el contrato del `ApiError` de las Firebase Functions.
 */
export class ApiError extends HttpException {
  constructor(
    statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super({ code, message }, statusCode);
    this.name = 'ApiError';
  }
}
