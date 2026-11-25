import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-error-page',
  imports: [RouterLink],
  template: `
    <section class="error-page">
      <h1>{{ title }}</h1>
      <p>{{ message }}</p>

      <div class="actions">
        <a class="btn" [routerLink]="home()">Volver al inicio</a>
      </div>

      @if (returnUrl) {
        <small>Dirección solicitada: {{ returnUrl }}</small>
      }
    </section>
  `,
  styles: `
    .error-page {
      display: grid;
      justify-items: start;
      gap: var(--s-3);
      max-width: 36rem;
      padding: var(--s-8) var(--s-5);
      margin-inline: auto;

      h1 {
        margin: 0;
        font-size: var(--fs-display);
        letter-spacing: -0.02em;
      }

      p {
        margin: 0;
        color: var(--ink-2);
        font-size: 1.125rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorPage {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  readonly code = this.route.snapshot.queryParamMap.get('code') ?? 'NOT_FOUND';
  readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

  /** Cada rol vuelve a su pantalla; sin sesión, al inicio de sesión. */
  readonly home = computed(() => {
    const role = this.auth.role();
    if (role === 'STUDENT') {
      return '/student';
    }
    return role ? '/admin/dashboard' : '/login';
  });

  readonly title = this.code === 'ROLE_FORBIDDEN' ? 'No tienes acceso a esta sección' : 'No encontramos esta página';

  readonly message =
    this.code === 'ROLE_FORBIDDEN'
      ? 'Tu rol no tiene permisos para entrar aquí. Si crees que es un error, avisa a un administrador.'
      : 'La dirección no existe o ya no está disponible. Revisa el enlace o vuelve al inicio.';
}
