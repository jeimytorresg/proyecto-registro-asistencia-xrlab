import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiError } from './api-error';
import { type ApiErrorBody, UNKNOWN_REQUEST_ID } from './api-response';

interface ErrorDescription {
  status: number;
  code: string;
  message: string;
}

const CODE_BY_STATUS: Readonly<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
};

const INTERNAL_ERROR_MESSAGE = 'Ocurrió un error interno. Use el requestId para soporte.';
const RATE_LIMITED_MESSAGE = 'Demasiadas solicitudes. Intente de nuevo en un momento.';
const PAYLOAD_TOO_LARGE_MESSAGE = 'El cuerpo de la solicitud es demasiado grande.';
const BAD_REQUEST_MESSAGE = 'La solicitud no es válida.';
const GENERIC_CLIENT_ERROR_MESSAGE = 'No se pudo procesar la solicitud.';

function codeForStatus(status: number): string {
  return CODE_BY_STATUS[status] ?? 'HTTP_ERROR';
}

/** Errores 4xx de librerías (p. ej. body-parser) que no son `HttpException` pero se pueden exponer. */
function isExposableClientError(error: unknown): error is { status: number } {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { status?: unknown; expose?: unknown };

  return (
    typeof candidate.status === 'number' &&
    candidate.status >= 400 &&
    candidate.status < 500 &&
    candidate.expose === true
  );
}

function messageForClientError(status: number): string {
  if (status === 413) {
    return PAYLOAD_TOO_LARGE_MESSAGE;
  }

  return status === 400 ? BAD_REQUEST_MESSAGE : GENERIC_CLIENT_ERROR_MESSAGE;
}

/** Convierte cualquier excepción en el envelope de error `{ ok: false, error }` del contrato HTTP. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const requestId = String(response.locals?.['requestId'] ?? UNKNOWN_REQUEST_ID);

    const { status, code, message } = this.describe(exception, request);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Error no controlado (requestId=${requestId})`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // Si la respuesta ya empezó a enviarse (p. ej. un stream) no se puede escribir otra.
    if (response.headersSent) {
      return;
    }

    const body: ApiErrorBody = { ok: false, error: { code, message, requestId } };

    response.status(status).json(body);
  }

  private describe(exception: unknown, request: Request): ErrorDescription {
    if (exception instanceof ApiError) {
      return { status: exception.getStatus(), code: exception.code, message: exception.message };
    }

    if (exception instanceof HttpException) {
      return this.describeHttpException(exception, request);
    }

    if (isExposableClientError(exception)) {
      return {
        status: exception.status,
        code: codeForStatus(exception.status),
        message: messageForClientError(exception.status),
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: INTERNAL_ERROR_MESSAGE,
    };
  }

  private describeHttpException(exception: HttpException, request: Request): ErrorDescription {
    const status = exception.getStatus();
    const code = codeForStatus(status);

    if (status === HttpStatus.NOT_FOUND) {
      return { status, code, message: `Ruta no encontrada: ${request.method} ${request.path}` };
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      return { status, code, message: RATE_LIMITED_MESSAGE };
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return { status, code: 'INTERNAL_ERROR', message: INTERNAL_ERROR_MESSAGE };
    }

    return { status, code, message: exception.message };
  }
}
