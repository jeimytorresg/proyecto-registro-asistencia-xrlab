import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function requestContext(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incomingRequestId = req.header('X-Request-Id');

  const requestId =
    incomingRequestId && incomingRequestId.length <= 80
      ? incomingRequestId
      : randomUUID();

  res.locals['requestId'] = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}
