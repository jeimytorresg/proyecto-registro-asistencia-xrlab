import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'X-Request-Id';
// Solo caracteres seguros y hasta 80: el id se refleja en cabecera, body JSON y logs.
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,80}$/;

/** Asigna un request id (el entrante si es válido, o uno nuevo) y lo devuelve en la cabecera. */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId = incoming && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();

  res.locals['requestId'] = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  next();
}
