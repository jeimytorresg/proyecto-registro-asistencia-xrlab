import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { AttendanceListResult } from '../../../core/models/admin-pc4.models';
import { AdminPc4Service } from '../../../core/services/admin-pc4.service';

@Component({
  selector: 'app-admin-attendance',
  imports: [ReactiveFormsModule],
  template: `
    <section class="page-grid">
      <article class="card hero-card">
        <p class="eyebrow">Registros · PC4</p>
        <h1>Consulta de asistencias</h1>
        <p class="lead">Filtre registros y exporte el resultado permitido por su rol.</p>

        <form class="filter-grid" [formGroup]="form" (ngSubmit)="load()">
          <div class="field">
            <label>Estudiante</label>
            <input formControlName="studentEmail" placeholder="Correo, nombre o código" />
          </div>
          <div class="field">
            <label>Estado</label>
            <select formControlName="status">
              <option value="">Todos</option>
              <option value="OPEN">OPEN</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="INCOMPLETE_AUTO_VOIDED">INCOMPLETE_AUTO_VOIDED</option>
              <option value="MANUAL_CREATED">MANUAL_CREATED</option>
              <option value="MANUAL_CORRECTED">MANUAL_CORRECTED</option>
            </select>
          </div>
          <div class="field">
            <label>Origen</label>
            <select formControlName="source">
              <option value="">Todos</option>
              <option value="STUDENT_QR">STUDENT_QR</option>
              <option value="ADMIN_MANUAL">ADMIN_MANUAL</option>
              <option value="TEACHER_MANUAL">TEACHER_MANUAL</option>
            </select>
          </div>
          <div class="field">
            <label>Desde</label>
            <input type="date" formControlName="dateFrom" />
          </div>
          <div class="field">
            <label>Hasta</label>
            <input type="date" formControlName="dateTo" />
          </div>
          <div class="actions">
            <button class="btn" type="submit">Aplicar filtros</button>
            <button class="btn secondary" type="button" (click)="exportExcel()">Exportar Excel</button>
          </div>
        </form>

        @if (error()) { <div class="error-box">{{ error() }}</div> }
      </article>

      <article class="card">
        <h2>Registros encontrados: {{ result()?.total ?? 0 }}</h2>
        <div class="table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Duración</th>
                <th>Estado</th>
                <th>Origen</th>
                <th>Actividades</th>
              </tr>
            </thead>
            <tbody>
              @for (row of result()?.rows ?? []; track row.id) {
                <tr>
                  <td><strong>{{ row.studentName }}</strong><small>{{ row.studentEmail }}</small></td>
                  <td>{{ row.entryAt }}</td>
                  <td>{{ row.exitAt ?? '-' }}</td>
                  <td>{{ row.durationMinutes ?? '-' }} min</td>
                  <td><span class="badge">{{ row.status }}</span></td>
                  <td><span class="badge badge-warn">{{ row.source }}</span></td>
                  <td>{{ activitiesText(row.activities) }}</td>
                </tr>
              } @empty {
                <tr><td colspan="7">No hay registros con esos filtros.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAttendance {
  private readonly api = inject(AdminPc4Service);
  private readonly fb = inject(FormBuilder);
  readonly result = signal<AttendanceListResult | null>(null);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    studentEmail: [''],
    status: [''],
    source: [''],
    dateFrom: [''],
    dateTo: [''],
  });

  constructor() { void this.load(); }

  async load(): Promise<void> {
    this.error.set(null);
    try { this.result.set(await this.api.attendance(this.params())); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'No se pudo cargar.'); }
  }

  async exportExcel(): Promise<void> {
    this.error.set(null);
    try { await this.api.exportAttendance(this.params()); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'No se pudo exportar.'); }
  }

  activitiesText(items: { description: string }[]): string {
    return items.map((item) => item.description).join('; ');
  }

  private params(): Record<string, string> {
    const raw = this.form.getRawValue();
    return Object.fromEntries(Object.entries(raw).filter(([, value]) => !!value)) as Record<string, string>;
  }
}
