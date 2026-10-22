import type { Response } from 'express';

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  message: string;
  requestId: string;
}

export interface ApiErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

function getRequestId(res: Response): string {
  return String(res.locals['requestId'] ?? 'unknown');
}

export function sendOk<T>(
  res: Response,
  data: T,
  message = 'Operación realizada correctamente.',
): Response<ApiSuccess<T>> {
  return res.status(200).json({
    ok: true,
    data,
    message,
    requestId: getRequestId(res),
  });
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
): Response<ApiErrorResponse> {
  const requestId = getRequestId(res);

  return res.status(statusCode).json({
    ok: false,
    error: {
      code,
      message,
      requestId,
    },
  });
}
