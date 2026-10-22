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
  completeAttendanceExit,
  scanAttendanceQr,
} from '../services/attendance.service.js';

export const attendanceRouter = Router();

const clientInfoSchema = z
  .object({
    userAgent: z.string().optional(),
    timezone: z.string().optional(),
  })
  .optional();

const attendanceScanSchema = z.object({
  qrToken: z.string().min(20),
  clientInfo: clientInfoSchema,
});

const attendanceExitSchema = z.object({
  qrToken: z.string().min(20),
  attendanceSessionId: z.string().uuid(),
  activities: z.array(z.string().trim().min(1)).min(1),
  clientInfo: clientInfoSchema,
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

attendanceRouter.post(
  '/scan',
  requireAuth(['STUDENT']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = parseBody(attendanceScanSchema, req.body);
    const authUser = req.authUser;

    if (!authUser) {
      throw new Error('authUser no fue definido por requireAuth.');
    }

    const result = await scanAttendanceQr({
      qrToken: body.qrToken,
      studentUserProfileId: authUser.profile.id,
      requestId: String(res.locals['requestId']),
      clientInfo: body.clientInfo,
    });

    return sendOk(res, result, result.message);
  }),
);

attendanceRouter.post(
  '/exit',
  requireAuth(['STUDENT']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = parseBody(attendanceExitSchema, req.body);
    const authUser = req.authUser;

    if (!authUser) {
      throw new Error('authUser no fue definido por requireAuth.');
    }

    const result = await completeAttendanceExit({
      qrToken: body.qrToken,
      attendanceSessionId: body.attendanceSessionId,
      activities: body.activities,
      studentUserProfileId: authUser.profile.id,
      requestId: String(res.locals['requestId']),
      clientInfo: body.clientInfo,
    });

    return sendOk(res, result, result.message);
  }),
);
