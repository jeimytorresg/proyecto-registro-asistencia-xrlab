import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AdminCatalogs } from '../../../core/models/admin-pc4.models';
import { Alert, Badge, EmptyState, Confirm } from '../../../shared/ui';
import { AdminPc4Service } from '../../../core/services/admin-pc4.service';

@Component({
  selector: 'app-admin-students',
  imports: [ReactiveFormsModule, Alert, Badge, EmptyState],
  templateUrl: './admin-students.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStudents {
  readonly editing = signal(false);

  private readonly api = inject(AdminPc4Service);
  private readonly confirm = inject(Confirm);
  private readonly fb = inject(FormBuilder);
  readonly catalogs = signal<AdminCatalogs | null>(null);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({
    id: [''], universityCode: ['', Validators.required], email: ['', [Validators.required, Validators.email]], firstName: ['', Validators.required], lastName: ['', Validators.required], careerId: [''], practiceTypeId: [''], teacherId: [''],
  });
  constructor() { void this.load(); }
  async load(): Promise<void> { try { this.catalogs.set(await this.api.catalogs()); } catch (e) { this.error.set(e instanceof Error ? e.message : 'No se pudo completar la acción. Inténtalo de nuevo.'); } }
  edit(student: any): void { this.editing.set(true); this.form.patchValue({ id: student.id, universityCode: student.universityCode, email: student.email, firstName: student.firstName, lastName: student.lastName, careerId: student.careerId ?? '', practiceTypeId: student.practiceTypeId ?? '', teacherId: '' }); }
  clear(): void { this.editing.set(false); this.form.reset({ id: '', universityCode: '', email: '', firstName: '', lastName: '', careerId: '', practiceTypeId: '', teacherId: '' }); }
  async save(): Promise<void> {
    this.error.set(null); this.message.set(null);
    try {
      const result = await this.api.saveStudent(this.clean(this.form.getRawValue()));
      const invited = await this.api.sendInvitationIfPending(result);
      this.message.set(invited ? `Estudiante guardado. Enviamos una invitación a ${result.email} para que cree su contraseña.` : 'Estudiante guardado.');
      this.clear(); await this.load();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'No se pudo completar la acción. Inténtalo de nuevo.'); }
  }
  async invite(id: string): Promise<void> {
    this.error.set(null); this.message.set(null);
    try { const email = await this.api.inviteStudent(id); this.message.set(`Invitación enviada a ${email}.`); } catch (e) { this.error.set(e instanceof Error ? e.message : 'No se pudo completar la acción. Inténtalo de nuevo.'); }
  }
  async deactivate(student: { id: string; firstName: string; lastName: string }): Promise<void> { const id = student.id; if (!(await this.confirm.ask({ title: `¿Desactivar a ${student.firstName} ${student.lastName}?`, message: 'Ya no podrá registrar entradas ni salidas. Sus registros anteriores se conservan.', confirmLabel: 'Desactivar' }))) { return; } try { await this.api.deactivateStudent(id); this.message.set('Estudiante desactivado.'); await this.load(); } catch (e) { this.error.set(e instanceof Error ? e.message : 'No se pudo completar la acción. Inténtalo de nuevo.'); } }
  private clean(raw: any): Record<string, unknown> { return Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== '')); }
}
