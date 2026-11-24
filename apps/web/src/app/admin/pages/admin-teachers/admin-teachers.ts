import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AdminCatalogs } from '../../../core/models/admin-pc4.models';
import { Alert, Badge, EmptyState } from '../../../shared/ui';
import { AdminPc4Service } from '../../../core/services/admin-pc4.service';

@Component({
  selector: 'app-admin-teachers',
  imports: [ReactiveFormsModule, Alert, Badge, EmptyState],
  templateUrl: './admin-teachers.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTeachers {
  readonly editing = signal(false);

  private readonly api = inject(AdminPc4Service); private readonly fb = inject(FormBuilder);
  readonly catalogs = signal<AdminCatalogs | null>(null); readonly error = signal<string | null>(null); readonly message = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({ id: [''], institutionalEmail: ['', [Validators.required, Validators.email]], firstName: ['', Validators.required], lastName: ['', Validators.required] });
  constructor() { void this.load(); }
  async load(): Promise<void> { try { this.catalogs.set(await this.api.catalogs()); } catch (e) { this.error.set(e instanceof Error ? e.message : 'Error'); } }
  edit(t: any): void { this.editing.set(true); this.form.patchValue({ id: t.id, institutionalEmail: t.institutionalEmail, firstName: t.firstName, lastName: t.lastName }); }
  clear(): void { this.editing.set(false); this.form.reset({ id: '', institutionalEmail: '', firstName: '', lastName: '' }); }
  async save(): Promise<void> {
    this.error.set(null); this.message.set(null);
    try {
      const result = await this.api.saveTeacher(Object.fromEntries(Object.entries(this.form.getRawValue()).filter(([, v]) => v !== '')));
      const invited = await this.api.sendInvitationIfPending({ email: result.institutionalEmail, invitationPending: result.invitationPending });
      this.message.set(invited ? `Docente guardado. Se envió una invitación a ${result.institutionalEmail} para crear su contraseña.` : 'Docente guardado.');
      this.clear(); await this.load();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Error'); }
  }
  async invite(id: string): Promise<void> {
    this.error.set(null); this.message.set(null);
    try { const email = await this.api.inviteTeacher(id); this.message.set(`Se envió una invitación a ${email}.`); } catch (e) { this.error.set(e instanceof Error ? e.message : 'Error'); }
  }
  async deactivate(id: string): Promise<void> { try { await this.api.deactivateTeacher(id); this.message.set('Docente desactivado.'); await this.load(); } catch (e) { this.error.set(e instanceof Error ? e.message : 'Error'); } }
}
