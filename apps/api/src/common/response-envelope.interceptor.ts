import {
  type CallHandler,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';
import { type ApiSuccess, DEFAULT_SUCCESS_MESSAGE, UNKNOWN_REQUEST_ID } from './api-response';
import { RESPONSE_MESSAGE_KEY } from './response-message.decorator';

/** Envuelve todo resultado exitoso en `{ ok, data, message, requestId }`. */
@Injectable()
export class ResponseEnvelopeInterceptor<T = unknown> implements NestInterceptor<T, ApiSuccess<T | null>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T | null>> {
    const message =
      this.reflector.getAllAndOverride<string | undefined>(RESPONSE_MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_SUCCESS_MESSAGE;

    const response = context.switchToHttp().getResponse<Response>();
    const requestId = String(response.locals?.['requestId'] ?? UNKNOWN_REQUEST_ID);

    return next.handle().pipe(
      map((data) => {
        // Nest responde 201 en los POST; el backend Express original siempre respondía 200 en éxito.
        if (response.statusCode === HttpStatus.CREATED) {
          response.status(HttpStatus.OK);
        }

        return { ok: true as const, data: data ?? null, message, requestId };
      }),
    );
  }
}
