import { Router } from 'express';
import { sendOk } from '../http/api-response.js';
import {
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/auth-middleware.js';

export const authRouter = Router();

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
