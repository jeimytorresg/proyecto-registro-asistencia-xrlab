import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AdminCatalogs } from '../../../core/models/admin-pc4.models';
import { Alert, Badge, EmptyState, Confirm } from '../../../shared/ui';
import { AdminPc4Service } from '../../../core/services/admin-pc4.service';

@Component({
  selector: 'app-admin-teachers',
  imports: [ReactiveFormsModule, Alert, Badge, EmptyState],
  templateUrl: './admin-teachers.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTeachers {
  readonly editing = signal(false);

  private readonly api = inject(AdminPc4Service);
  private readonly confirm = inject(Confirm); private readonly fb = inject(FormBuilder);
  readonly catalogs = signal<AdminCatalogs | null>(null); readonly error = signal<string | null>(null); readonly message = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({ id: [''], institutionalEmail: ['', [Validators.required, Validators.email]], firstName: ['', Validators.required], lastName: ['', Validators.required] });
  constructor() { void this.load(); }
  async load(): Promise<void> { try { this.catalogs.set(await this.api.catalogs()); } catch (e) { this.error.set(e instanceof Error ? e.message : 'No se pudo completar la acción. Inténtalo de nuevo.'); } }
  edit(t: any): void { this.editing.set(true); this.form.patchValue({ id: t.id, institutionalEmail: t.institutionalEmail, firstName: t.firstName, lastName: t.lastName }); }
  clear(): void { this.editing.set(false); this.form.reset({ id: '', institutionalEmail: '', firstName: '', lastName: '' }); }
  async save(): Promise<void> {
    this.error.set(null); this.message.set(null);
    try {
      const result = await this.api.saveTeacher(Object.fromEntries(Object.entries(this.form.getRawValue()).filter(([, v]) => v !== '')));
      this.message.set(result.firstAccessPending ? `Docente guardado. Para activar su cuenta, ${result.institutionalEmail} debe abrir el login, escribir su correo y crear su contraseña.` : 'Docente guardado.');
      this.clear(); await this.load();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'No se pudo completar la acción. Inténtalo de nuevo.'); }
  }
  async resetAccess(teacher: { id: string; firstName: string; lastName: string }): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `¿Restablecer el acceso de ${teacher.firstName} ${teacher.lastName}?`,
      message: 'Se borra su contraseña actual y se cierran sus sesiones. Para volver a entrar deberá crear una contraseña nueva desde el login.',
      confirmLabel: 'Restablecer acceso',
    });

    if (!confirmed) {
      return;
    }

    this.error.set(null); this.message.set(null);
    try {
      const r = await this.api.resetTeacherAccess(teacher.id);
      this.message.set(`Se restableció el acceso de ${r.email}. Cuando abra el login y escriba su correo, podrá crear una nueva contraseña.`);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'No se pudo completar la acción. Inténtalo de nuevo.'); }
  }
  async deactivate(teacher: { id: string; firstName: string; lastName: string }): Promise<void> { const id = teacher.id; if (!(await this.confirm.ask({ title: `¿Desactivar a ${teacher.firstName} ${teacher.lastName}?`, message: 'Ya no podrá operar en el sistema. Sus registros anteriores se conservan.', confirmLabel: 'Desactivar' }))) { return; } try { await this.api.deactivateTeacher(id); this.message.set('Docente desactivado.'); await this.load(); } catch (e) { this.error.set(e instanceof Error ? e.message : 'No se pudo completar la acción. Inténtalo de nuevo.'); } }
}
