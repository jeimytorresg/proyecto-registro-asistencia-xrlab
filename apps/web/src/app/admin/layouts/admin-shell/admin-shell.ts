import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink],
  template: `
    <section class="admin-shell">
      <aside class="card admin-sidebar">
        <p class="eyebrow">Panel XRLAB</p>

        @if (auth.session(); as session) {
          <h2>{{ session.role }}</h2>
          <p class="lead">{{ session.profile.firstName }} {{ session.profile.lastName }}</p>
        }

        <nav aria-label="Navegación administrativa">
          <a routerLink="/admin/dashboard">Dashboard</a>
          <a routerLink="/admin/attendance">Registros</a>
          <a routerLink="/admin/students">Estudiantes</a>
          <a routerLink="/admin/manual-records">Registro manual</a>
          <a routerLink="/admin/audit">Auditoría</a>

          @if (auth.role() === 'ADMIN') {
            <a routerLink="/admin/teachers">Docentes</a>
            <a routerLink="/admin/periods">Periodos</a>
            <a routerLink="/admin/kiosks">Kioskos</a>
          }

          <a routerLink="/kiosk">Abrir kiosko</a>
        </nav>
      </aside>

      <div>
        <router-outlet />
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShell {
  readonly auth = inject(AuthService);
}
