import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AdminCatalogs } from '../../../core/models/admin-pc4.models';
import { AdminPc4Service } from '../../../core/services/admin-pc4.service';

@Component({
  selector: 'app-admin-students',
  imports: [ReactiveFormsModule],
  template: `
    <section class="page-grid">
      <article class="card hero-card">
        <p class="eyebrow">Estudiantes · PC4</p>
        <h1>Gestión de estudiantes</h1>
        <p class="lead">Crear, editar y desactivar sin borrar físicamente. Al crear un estudiante se le envía un correo para que defina su contraseña.</p>

        <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
          <input type="hidden" formControlName="id" />
          <div class="form-two">
            <div class="field"><label>Código</label><input formControlName="universityCode" /></div>
            <div class="field"><label>Correo</label><input formControlName="email" /></div>
            <div class="field"><label>Nombre</label><input formControlName="firstName" /></div>
            <div class="field"><label>Apellido</label><input formControlName="lastName" /></div>
            <div class="field"><label>Carrera</label><select formControlName="careerId"><option value="">Sin carrera</option>@for (career of catalogs()?.careers ?? []; track career.id) { <option [value]="career.id">{{ career.name }}</option> }</select></div>
            <div class="field"><label>Tipo práctica</label><select formControlName="practiceTypeId"><option value="">Sin tipo</option>@for (type of catalogs()?.practiceTypes ?? []; track type.id) { <option [value]="type.id">{{ type.name }}</option> }</select></div>
            <div class="field"><label>Docente</label><select formControlName="teacherId"><option value="">Sin asignación</option>@for (teacher of catalogs()?.teachers ?? []; track teacher.id) { <option [value]="teacher.id">{{ teacher.institutionalEmail }}</option> }</select></div>
          </div>
          <div class="actions"><button class="btn" type="submit">Guardar estudiante</button><button class="btn secondary" type="button" (click)="clear()">Limpiar</button></div>
        </form>
        @if (message()) { <div class="success-box">{{ message() }}</div> }
        @if (error()) { <div class="error-box">{{ error() }}</div> }
      </article>

      <article class="card"><h2>Estudiantes</h2><div class="table-wrap"><table class="admin-table"><thead><tr><th>Código</th><th>Nombre</th><th>Correo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
        @for (student of catalogs()?.students ?? []; track student.id) {
          <tr><td>{{ student.universityCode }}</td><td>{{ student.firstName }} {{ student.lastName }}</td><td>{{ student.email }}</td><td>{{ student.active ? 'Activo' : 'Inactivo' }}</td><td><button class="link-button" type="button" (click)="edit(student)">Editar</button> @if (student.active) { <button class="link-button" type="button" (click)="invite(student.id)">Enviar invitación</button> } <button class="link-button" type="button" (click)="deactivate(student.id)">Desactivar</button></td></tr>
        } @empty { <tr><td colspan="5">Sin estudiantes.</td></tr> }
      </tbody></table></div></article>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStudents {
  private readonly api = inject(AdminPc4Service);
  private readonly fb = inject(FormBuilder);
  readonly catalogs = signal<AdminCatalogs | null>(null);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({
    id: [''], universityCode: ['', Validators.required], email: ['', [Validators.required, Validators.email]], firstName: ['', Validators.required], lastName: ['', Validators.required], careerId: [''], practiceTypeId: [''], teacherId: [''],
  });
  constructor() { void this.load(); }
  async load(): Promise<void> { try { this.catalogs.set(await this.api.catalogs()); } catch (e) { this.error.set(e instanceof Error ? e.message : 'Error'); } }
  edit(student: any): void { this.form.patchValue({ id: student.id, universityCode: student.universityCode, email: student.email, firstName: student.firstName, lastName: student.lastName, careerId: student.careerId ?? '', practiceTypeId: student.practiceTypeId ?? '', teacherId: '' }); }
  clear(): void { this.form.reset({ id: '', universityCode: '', email: '', firstName: '', lastName: '', careerId: '', practiceTypeId: '', teacherId: '' }); }
  async save(): Promise<void> {
    this.error.set(null); this.message.set(null);
    try {
      const result = await this.api.saveStudent(this.clean(this.form.getRawValue()));
      const invited = await this.api.sendInvitationIfPending(result);
      this.message.set(invited ? `Estudiante guardado. Se envió una invitación a ${result.email} para crear su contraseña.` : 'Estudiante guardado.');
      this.clear(); await this.load();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Error'); }
  }
  async invite(id: string): Promise<void> {
    this.error.set(null); this.message.set(null);
    try { const email = await this.api.inviteStudent(id); this.message.set(`Se envió una invitación a ${email}.`); } catch (e) { this.error.set(e instanceof Error ? e.message : 'Error'); }
  }
  async deactivate(id: string): Promise<void> { try { await this.api.deactivateStudent(id); this.message.set('Estudiante desactivado.'); await this.load(); } catch (e) { this.error.set(e instanceof Error ? e.message : 'Error'); } }
  private clean(raw: any): Record<string, unknown> { return Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== '')); }
}
