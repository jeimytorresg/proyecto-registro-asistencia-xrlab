import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../http/api-error.js';
import { sendOk } from '../http/api-response.js';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/auth-middleware.js';
import {
  closeKioskSession,
  createQrBatchForKioskSession,
  openKioskSession,
} from '../services/kiosk.service.js';

export const kioskRouter = Router();

const openSessionSchema = z.object({
  kioskCode: z.string().min(1).default('XR-KIOSK-01'),
});

const closeSessionSchema = z.object({
  kioskSessionId: z.string().uuid(),
});

const qrBatchSchema = z.object({
  kioskSessionId: z.string().uuid(),
  batchSeconds: z.number().int().positive().max(120).optional(),
});

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
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

kioskRouter.post(
  '/sessions/open',
  requireAuth(['ADMIN', 'TEACHER']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = parseBody(openSessionSchema, req.body);
    const authUser = req.authUser;

    if (!authUser) {
      throw new Error('authUser no fue definido por requireAuth.');
    }

    const result = await openKioskSession({
      kioskCode: body.kioskCode ?? 'XR-KIOSK-01',
      actorUserProfileId: authUser.profile.id,
      actorRole: authUser.role,
      requestId: String(res.locals['requestId']),
    });

    return sendOk(
      res,
      result,
      result.reused ? 'Sesión de kiosko reutilizada.' : 'Sesión de kiosko abierta.',
    );
  }),
);

kioskRouter.post(
  '/sessions/close',
  requireAuth(['ADMIN', 'TEACHER']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = parseBody(closeSessionSchema, req.body);
    const authUser = req.authUser;

    if (!authUser) {
      throw new Error('authUser no fue definido por requireAuth.');
    }

    const result = await closeKioskSession({
      kioskSessionId: body.kioskSessionId,
      actorUserProfileId: authUser.profile.id,
      actorRole: authUser.role,
      requestId: String(res.locals['requestId']),
    });

    return sendOk(res, result, 'Sesión de kiosko cerrada.');
  }),
);

kioskRouter.post(
  '/qr/batch',
  requireAuth(['ADMIN', 'TEACHER']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = parseBody(qrBatchSchema, req.body);

    const result = await createQrBatchForKioskSession({
      kioskSessionId: body.kioskSessionId,
      requestedBatchSeconds: body.batchSeconds,
    });

    return sendOk(res, result, 'Lote QR generado.');
  }),
);
