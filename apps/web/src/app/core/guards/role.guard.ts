import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import type { UserRole } from '../models/auth.models';
import { AuthService } from '../services/auth.service';

export function roleGuard(allowedRoles: readonly UserRole[]): CanActivateFn {
  return async (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await auth.waitUntilReady();

    const session = await auth.refreshSession(false).catch(() => null);

    if (!session) {
      return router.createUrlTree(['/login'], {
        queryParams: {
          returnUrl: state.url,
        },
      });
    }

    if (!allowedRoles.includes(session.role)) {
      return router.createUrlTree(['/error'], {
        queryParams: {
          code: 'ROLE_FORBIDDEN',
          returnUrl: state.url,
        },
      });
    }

    return true;
  };
}
