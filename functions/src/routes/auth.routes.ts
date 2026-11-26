import { Router } from 'express';
import { z } from 'zod';
import { sendOk } from '../http/api-response.js';
import { parseBody } from '../http/parse-body.js';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/auth-middleware.js';
import { completeFirstAccess, getAccessStatus } from '../services/first-access.service.js';

export const authRouter = Router();

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

const emailField = z
  .string({ required_error: 'El correo es obligatorio.' })
  .trim()
  .toLowerCase()
  .email('Ingrese un correo válido.')
  .max(254, 'El correo es demasiado largo.');

const accessStatusSchema = z.object({ email: emailField });

const firstAccessSchema = z
  .object({
    email: emailField,
    password: z
      .string({ required_error: 'La contraseña es obligatoria.' })
      .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`)
      .max(PASSWORD_MAX_LENGTH, `La contraseña no puede superar ${PASSWORD_MAX_LENGTH} caracteres.`)
      .regex(/\p{L}/u, 'La contraseña debe incluir al menos una letra.')
      .regex(/\d/, 'La contraseña debe incluir al menos un número.'),
    passwordConfirmation: z.string({ required_error: 'Confirme la contraseña.' }),
  })
  .refine((body) => body.password === body.passwordConfirmation, {
    message: 'Las contraseñas no coinciden.',
    path: ['passwordConfirmation'],
  });

/** Público: decide si el login pide la contraseña o la creación de contraseña (primer ingreso). */
authRouter.post(
  '/access-status',
  asyncHandler(async (req, res) => {
    const { email } = parseBody(accessStatusSchema, req.body);
    const status = await getAccessStatus(email);

    return sendOk(res, { status }, 'Estado de acceso consultado.');
  }),
);

/** Público: primer ingreso, guarda la contraseña de una cuenta registrada que aún no la tiene. */
authRouter.post(
  '/first-access',
  asyncHandler(async (req, res) => {
    const body = parseBody(firstAccessSchema, req.body);
    const result = await completeFirstAccess({
      email: body.email,
      password: body.password,
      requestId: String(res.locals['requestId']),
    });

    return sendOk(res, result, 'Contraseña creada. Ya puede iniciar sesión.');
  }),
);

authRouter.get(
  '/session-check',
  requireAuth(),
  (req: AuthenticatedRequest, res) => {
    const authUser = req.authUser;

    if (!authUser) {
      throw new Error('authUser no fue definido por requireAuth.');
    }

    return sendOk(
      res,
      {
        uid: authUser.uid,
        email: authUser.email,
        role: authUser.role,
        profile: authUser.profile,
      },
      'Sesión válida.',
    );
  },
);

authRouter.get(
  '/student-check',
  requireAuth(['STUDENT']),
  (req: AuthenticatedRequest, res) => {
    return sendOk(
      res,
      {
        role: req.authUser?.role,
        area: 'student',
      },
      'Acceso de estudiante confirmado.',
    );
  },
);

authRouter.get(
  '/admin-check',
  requireAuth(['ADMIN', 'TEACHER']),
  (req: AuthenticatedRequest, res) => {
    return sendOk(
      res,
      {
        role: req.authUser?.role,
        area: 'admin',
      },
      'Acceso administrativo confirmado.',
    );
  },
);
