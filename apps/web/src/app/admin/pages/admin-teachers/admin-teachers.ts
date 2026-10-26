import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AdminCatalogs } from '../../../core/models/admin-pc4.models';
import { AdminPc4Service } from '../../../core/services/admin-pc4.service';

@Component({
  selector: 'app-admin-teachers',
  imports: [ReactiveFormsModule],
  template: `
    <section class="page-grid"><article class="card hero-card"><p class="eyebrow">Docentes · PC4</p><h1>Gestión de docentes</h1><p class="lead">Al crear un docente se le envía un correo para que defina su contraseña.</p><form class="form-grid" [formGroup]="form" (ngSubmit)="save()"><input type="hidden" formControlName="id" /><div class="form-two"><div class="field"><label>Correo</label><input formControlName="institutionalEmail" /></div><div class="field"><label>Nombre</label><input formControlName="firstName" /></div><div class="field"><label>Apellido</label><input formControlName="lastName" /></div></div><div class="actions"><button class="btn" type="submit">Guardar docente</button><button class="btn secondary" type="button" (click)="clear()">Limpiar</button></div></form>@if (message()) { <div class="success-box">{{ message() }}</div> }@if (error()) { <div class="error-box">{{ error() }}</div> }</article><article class="card"><h2>Docentes</h2><div class="table-wrap"><table class="admin-table"><thead><tr><th>Correo</th><th>Nombre</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>@for (teacher of catalogs()?.teachers ?? []; track teacher.id) {<tr><td>{{ teacher.institutionalEmail }}</td><td>{{ teacher.firstName }} {{ teacher.lastName }}</td><td>{{ teacher.active ? 'Activo' : 'Inactivo' }}</td><td><button class="link-button" type="button" (click)="edit(teacher)">Editar</button> @if (teacher.active) { <button class="link-button" type="button" (click)="invite(teacher.id)">Enviar invitación</button> } <button class="link-button" type="button" (click)="deactivate(teacher.id)">Desactivar</button></td></tr>} @empty {<tr><td colspan="4">Sin docentes.</td></tr>}</tbody></table></div></article></section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTeachers {
  private readonly api = inject(AdminPc4Service); private readonly fb = inject(FormBuilder);
  readonly catalogs = signal<AdminCatalogs | null>(null); readonly error = signal<string | null>(null); readonly message = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({ id: [''], institutionalEmail: ['', [Validators.required, Validators.email]], firstName: ['', Validators.required], lastName: ['', Validators.required] });
  constructor() { void this.load(); }
  async load(): Promise<void> { try { this.catalogs.set(await this.api.catalogs()); } catch (e) { this.error.set(e instanceof Error ? e.message : 'Error'); } }
  edit(t: any): void { this.form.patchValue({ id: t.id, institutionalEmail: t.institutionalEmail, firstName: t.firstName, lastName: t.lastName }); }
  clear(): void { this.form.reset({ id: '', institutionalEmail: '', firstName: '', lastName: '' }); }
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
