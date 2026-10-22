import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-error-page',
  imports: [RouterLink],
  template: `
    <section class="card hero-card">
      <p class="eyebrow">Error controlado</p>
      <h1>{{ title }}</h1>
      <p class="lead">{{ message }}</p>

      @if (returnUrl) {
        <div class="warning-box">
          Ruta solicitada: {{ returnUrl }}
        </div>
      }

      <div class="actions">
        <a class="btn" routerLink="/login">Volver al login</a>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorPage {
  private readonly route = inject(ActivatedRoute);

  readonly code = this.route.snapshot.queryParamMap.get('code') ?? 'NOT_FOUND';
  readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

  readonly title =
    this.code === 'ROLE_FORBIDDEN'
      ? 'Acceso no autorizado'
      : 'Ruta no disponible';

  readonly message =
    this.code === 'ROLE_FORBIDDEN'
      ? 'Su rol no tiene permisos para acceder a esta sección.'
      : 'La ruta solicitada no existe o todavía no está habilitada para este punto de control.';
}
