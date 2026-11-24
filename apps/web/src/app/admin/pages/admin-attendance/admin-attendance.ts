import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { AttendanceListResult } from '../../../core/models/admin-pc4.models';
import { Alert, Badge, EmptyState, Icon } from '../../../shared/ui';
import { fmt, SOURCE_OPTIONS, STATUS_OPTIONS } from '../../../shared/format';
import { Download } from 'lucide-angular';
import { AdminPc4Service } from '../../../core/services/admin-pc4.service';

@Component({
  selector: 'app-admin-attendance',
  imports: [ReactiveFormsModule, Alert, Badge, EmptyState, Icon],
  templateUrl: './admin-attendance.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAttendance {
  readonly fmt = fmt;
  readonly statusOptions = STATUS_OPTIONS;
  readonly sourceOptions = SOURCE_OPTIONS;
  readonly downloadIcon = Download;

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

  reset(): void {
    this.form.reset();
    void this.load();
  }

  activitiesText(items: { description: string }[]): string {
    return items.map((item) => item.description).join('; ');
  }

  private params(): Record<string, string> {
    const raw = this.form.getRawValue();
    return Object.fromEntries(Object.entries(raw).filter(([, value]) => !!value)) as Record<string, string>;
  }
}
