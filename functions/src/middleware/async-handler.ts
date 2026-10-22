import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncHandler<TRequest extends Request = Request> = (
  req: TRequest,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler<TRequest extends Request = Request>(
  handler: AsyncHandler<TRequest>,
): RequestHandler {
  return (req, res, next) => {
    void handler(req as TRequest, res, next).catch(next);
  };
}
