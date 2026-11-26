import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as logger from 'firebase-functions/logger';
import { isApiError } from './http/api-error.js';
import { sendError, sendOk } from './http/api-response.js';
import { requestContext } from './middleware/request-context.js';
import { adminRouter } from './routes/admin.routes.js';
import { attendanceRouter } from './routes/attendance.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { kioskRouter } from './routes/kiosk.routes.js';

export const app = express();

app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

app.use(cors({ origin: true }));
app.use(express.json({ limit: '300kb' }));
app.use(requestContext);

app.get('/api/health', (_req: Request, res: Response) => {
  return sendOk(
    res,
    {
      service: 'xrlab-api',
      status: 'healthy',
      environment:
        process.env.FUNCTIONS_EMULATOR === 'true'
          ? 'local-emulator'
          : process.env.VERCEL
            ? 'vercel'
            : 'cloud',
      timestamp: new Date().toISOString(),
    },
    'API XRLAB operativa',
  );
});

app.use('/api/auth', authRouter);
app.use('/api/kiosk', kioskRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/admin', adminRouter);

app.use((req: Request, res: Response) => {
  return sendError(
    res,
    404,
    'NOT_FOUND',
    `Ruta no encontrada: ${req.method} ${req.path}`,
  );
});

app.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (isApiError(err)) {
      return sendError(res, err.statusCode, err.code, err.message);
    }

    logger.error('Unhandled API error', {
      requestId: res.locals['requestId'],
      error: err,
    });

    return sendError(
      res,
      500,
      'INTERNAL_ERROR',
      'Ocurrió un error interno. Use el requestId para soporte.',
    );
  },
);
