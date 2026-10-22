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
  getAdminAttendanceList,
  getAdminDashboard,
} from '../services/admin.service.js';
import {
  activatePeriod,
  closePeriod,
  createOrCorrectManualRecord,
  deactivateKiosk,
  deactivateStudent,
  deactivateTeacher,
  exportAttendanceExcel,
  listAdminCatalogs,
  listAuditLogs,
  saveCatalogItem,
  saveKiosk,
  savePeriod,
  saveStudent,
  saveTeacher,
  voidIncompleteSessions,
} from '../services/admin-pc4.service.js';

export const adminRouter = Router();

const attendanceQuerySchema = z.object({
  periodId: z.string().uuid().optional(),
  status: z
    .enum([
      'OPEN',
      'COMPLETED',
      'INCOMPLETE_AUTO_VOIDED',
      'MANUAL_CREATED',
      'MANUAL_CORRECTED',
    ])
    .optional(),
  source: z.enum(['STUDENT_QR', 'TEACHER_MANUAL', 'ADMIN_MANUAL']).optional(),
  studentEmail: z.string().trim().min(1).optional(),
  dateFrom: z.string().trim().min(1).optional(),
  dateTo: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const auditQuerySchema = z.object({
  actor: z.string().trim().min(1).optional(),
  action: z.string().trim().min(1).optional(),
  entityType: z.string().trim().min(1).optional(),
  source: z.string().trim().min(1).optional(),
  dateFrom: z.string().trim().min(1).optional(),
  dateTo: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const catalogItemSchema = z.object({
  name: z.string().trim().min(1),
});

const studentSchema = z.object({
  id: z.string().uuid().optional(),
  universityCode: z.string().trim().min(1),
  email: z.string().email(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  careerId: z.string().uuid().nullable().optional(),
  practiceTypeId: z.string().uuid().nullable().optional(),
  teacherId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
});

const teacherSchema = z.object({
  id: z.string().uuid().optional(),
  institutionalEmail: z.string().email(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  active: z.boolean().optional(),
});

const periodSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  startDate: z.string().trim().min(1),
  endDate: z.string().trim().min(1),
});

const kioskSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  location: z.string().trim().min(1),
  active: z.boolean().optional(),
});

const manualRecordSchema = z.object({
  attendanceSessionId: z.string().uuid().optional(),
  studentId: z.string().uuid(),
  teacherId: z.string().uuid().nullable().optional(),
  academicPeriodId: z.string().uuid().nullable().optional(),
  kioskId: z.string().uuid().nullable().optional(),
  entryAt: z.string().trim().min(1),
  exitAt: z.string().trim().min(1),
  activities: z.array(z.string().trim().min(1)).min(1),
  reason: z.string().trim().min(5),
});

function parseQuery<T>(schema: z.ZodSchema<T>, query: unknown): T {
  const parsed = schema.safeParse(query);

  if (!parsed.success) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      parsed.error.issues.map((issue) => issue.message).join('; '),
    );
  }

  return parsed.data;
}

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

function requireAuthUser(req: AuthenticatedRequest) {
  const authUser = req.authUser;
  if (!authUser) {
    throw new Error('authUser no fue definido por requireAuth.');
  }
  return authUser;
}

adminRouter.get(
  '/attendance',
  requireAuth(['ADMIN', 'TEACHER']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const authUser = requireAuthUser(req);
    const filters = parseQuery(attendanceQuerySchema, req.query);

    const result = await getAdminAttendanceList({
      authUser,
      filters: {
        ...filters,
        limit: filters.limit ?? 100,
        offset: filters.offset ?? 0,
      },
    });

    return sendOk(res, result, 'Registros de asistencia consultados.');
  }),
);

adminRouter.get(
  '/attendance/export',
  requireAuth(['ADMIN', 'TEACHER']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const authUser = requireAuthUser(req);
    const filters = parseQuery(attendanceQuerySchema, req.query);

    const buffer = await exportAttendanceExcel({
      authUser,
      filters: {
        ...filters,
        limit: filters.limit ?? 1000,
        offset: filters.offset ?? 0,
      },
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="xrlab-asistencias.xlsx"');
    return res.status(200).send(buffer);
  }),
);

adminRouter.get(
  '/dashboard',
  requireAuth(['ADMIN', 'TEACHER']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const authUser = requireAuthUser(req);
    const result = await getAdminDashboard({ authUser });
    return sendOk(res, result, 'Dashboard consultado.');
  }),
);

adminRouter.get(
  '/catalogs',
  requireAuth(['ADMIN', 'TEACHER']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const result = await listAdminCatalogs(requireAuthUser(req));
    return sendOk(res, result, 'Catálogos consultados.');
  }),
);

adminRouter.post(
  '/careers',
  requireAuth(['ADMIN', 'TEACHER']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = parseBody(catalogItemSchema, req.body);
    const result = await saveCatalogItem({ table: 'careers', name: body.name });
    return sendOk(res, result, 'Carrera guardada.');
  }),
);

adminRouter.post(
  '/practice-types',
  requireAuth(['ADMIN', 'TEACHER']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = parseBody(catalogItemSchema, req.body);
    const result = await saveCatalogItem({ table: 'practice_types', name: body.name });
    return sendOk(res, result, 'Tipo de práctica guardado.');
  }),
);

adminRouter.post(
  '/students',
  requireAuth(['ADMIN', 'TEACHER']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = parseBody(studentSchema, req.body);
    const result = await saveStudent({
      authUser: requireAuthUser(req),
      input: body,
      requestId: String(res.locals['requestId']),
    });
    return sendOk(res, result, 'Estudiante guardado.');
  }),
);

adminRouter.post(
  '/students/:id/deactivate',
  requireAuth(['ADMIN', 'TEACHER']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const result = await deactivateStudent({
      authUser: requireAuthUser(req),
      id: Array.isArray(req.params['id']) ? req.params['id'][0] : req.params['id'],
      requestId: String(res.locals['requestId']),
    });
    return sendOk(res, result, 'Estudiante desactivado.');
  }),
);

adminRouter.post(
  '/teachers',
  requireAuth(['ADMIN']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = parseBody(teacherSchema, req.body);
    const result = await saveTeacher({
      authUser: requireAuthUser(req),
      input: body,
      requestId: String(res.locals['requestId']),
    });
    return sendOk(res, result, 'Docente guardado.');
  }),
);

adminRouter.post(
  '/teachers/:id/deactivate',
  requireAuth(['ADMIN']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const result = await deactivateTeacher({
      authUser: requireAuthUser(req),
      id: Array.isArray(req.params['id']) ? req.params['id'][0] : req.params['id'],
      requestId: String(res.locals['requestId']),
    });
    return sendOk(res, result, 'Docente desactivado.');
  }),
);

adminRouter.post(
  '/periods',
  requireAuth(['ADMIN']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = parseBody(periodSchema, req.body);
    const result = await savePeriod({
      authUser: requireAuthUser(req),
      input: body,
      requestId: String(res.locals['requestId']),
    });
    return sendOk(res, result, 'Periodo guardado.');
  }),
);

adminRouter.post(
  '/periods/:id/activate',
  requireAuth(['ADMIN']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const result = await activatePeriod({
      authUser: requireAuthUser(req),
      id: Array.isArray(req.params['id']) ? req.params['id'][0] : req.params['id'],
      requestId: String(res.locals['requestId']),
    });
    return sendOk(res, result, 'Periodo activado.');
  }),
);

adminRouter.post(
  '/periods/:id/close',
  requireAuth(['ADMIN']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const result = await closePeriod({
      authUser: requireAuthUser(req),
      id: Array.isArray(req.params['id']) ? req.params['id'][0] : req.params['id'],
      requestId: String(res.locals['requestId']),
    });
    return sendOk(res, result, 'Periodo cerrado.');
  }),
);

adminRouter.post(
  '/kiosks',
  requireAuth(['ADMIN']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = parseBody(kioskSchema, req.body);
    const result = await saveKiosk({
      authUser: requireAuthUser(req),
      input: body,
      requestId: String(res.locals['requestId']),
    });
    return sendOk(res, result, 'Kiosko guardado.');
  }),
);

adminRouter.post(
  '/kiosks/:id/deactivate',
  requireAuth(['ADMIN']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const result = await deactivateKiosk({
      authUser: requireAuthUser(req),
      id: Array.isArray(req.params['id']) ? req.params['id'][0] : req.params['id'],
    });
    return sendOk(res, result, 'Kiosko desactivado.');
  }),
);

adminRouter.post(
  '/manual-records',
  requireAuth(['ADMIN', 'TEACHER']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = parseBody(manualRecordSchema, req.body);
    const result = await createOrCorrectManualRecord({
      authUser: requireAuthUser(req),
      input: body,
      requestId: String(res.locals['requestId']),
    });
    return sendOk(res, result, 'Registro manual guardado.');
  }),
);

adminRouter.get(
  '/audit-logs',
  requireAuth(['ADMIN', 'TEACHER']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const filters = parseQuery(auditQuerySchema, req.query);
    const result = await listAuditLogs({
      authUser: requireAuthUser(req),
      filters: {
        ...filters,
        limit: filters.limit ?? 100,
        offset: filters.offset ?? 0,
      },
    });
    return sendOk(res, result, 'Auditoría consultada.');
  }),
);

adminRouter.post(
  '/jobs/void-incomplete-sessions',
  requireAuth(['ADMIN']),
  asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const result = await voidIncompleteSessions({
      authUser: requireAuthUser(req),
      requestId: String(res.locals['requestId']),
    });
    return sendOk(res, result, 'Sesiones incompletas procesadas.');
  }),
);
