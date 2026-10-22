import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import type { DashboardSummary } from '../../../core/models/admin.models';
import { AdminService } from '../../../core/services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  template: `
    <section class="page-grid">
      <article class="card hero-card">
        <p class="eyebrow">Dashboard · PC3</p>
        <h1>Resumen operativo</h1>
        <p class="lead">
          Indicadores del periodo activo. Para docentes, los datos se limitan a sus estudiantes asignados.
        </p>

        @if (error(); as currentError) {
          <div class="error-box" role="alert">
            {{ currentError }}
          </div>
        }

        <div class="actions">
          <button class="btn secondary" type="button" [disabled]="isLoading()" (click)="load()">
            {{ isLoading() ? 'Cargando...' : 'Actualizar dashboard' }}
          </button>
        </div>
      </article>

      @if (dashboard(); as data) {
        <div class="metric-grid">
          <div class="metric-card">
            <strong>{{ data.studentsInside }}</strong>
            <span>Estudiantes dentro</span>
          </div>

          <div class="metric-card">
            <strong>{{ data.entriesToday }}</strong>
            <span>Entradas hoy</span>
          </div>

          <div class="metric-card">
            <strong>{{ data.exitsToday }}</strong>
            <span>Salidas hoy</span>
          </div>

          <div class="metric-card">
            <strong>{{ data.incompleteSessions }}</strong>
            <span>Sesiones incompletas</span>
          </div>

          <div class="metric-card">
            <strong>{{ data.totalHoursCurrentPeriod }}</strong>
            <span>Horas acumuladas</span>
          </div>
        </div>

        <article class="card">
          <h2>Últimos registros</h2>

          @if (data.latestRows.length === 0) {
            <div class="warning-box">
              Todavía no hay registros para mostrar.
            </div>
          } @else {
            <div class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th>Estado</th>
                    <th>Duración</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of data.latestRows; track row.id) {
                    <tr>
                      <td>
                        <strong>{{ row.studentName }}</strong>
                        <small>{{ row.studentEmail }}</small>
                      </td>
                      <td>{{ formatDate(row.entryAt) }}</td>
                      <td>{{ row.exitAt ? formatDate(row.exitAt) : '—' }}</td>
                      <td><span class="badge">{{ row.status }}</span></td>
                      <td>{{ row.durationMinutes ?? 0 }} min</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </article>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboard implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly dashboard = signal<DashboardSummary | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      this.dashboard.set(await this.adminService.getDashboard());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cargar el dashboard.');
    } finally {
      this.isLoading.set(false);
    }
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString('es-EC');
  }
}
