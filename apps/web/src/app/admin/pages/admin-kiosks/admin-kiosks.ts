import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AdminCatalogs } from '../../../core/models/admin-pc4.models';
import { Alert, EmptyState, Confirm } from '../../../shared/ui';
import { fmt } from '../../../shared/format';
import { AdminPc4Service } from '../../../core/services/admin-pc4.service';

@Component({ selector: 'app-admin-kiosks', imports: [ReactiveFormsModule, Alert, EmptyState], templateUrl: './admin-kiosks.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class AdminKiosks {
  readonly fmt = fmt;
  readonly editing = signal(false);
 private readonly api = inject(AdminPc4Service);
  private readonly confirm = inject(Confirm); private readonly fb = inject(FormBuilder); readonly catalogs = signal<AdminCatalogs | null>(null); readonly error = signal<string | null>(null); readonly message = signal<string | null>(null); readonly form = this.fb.nonNullable.group({ id: [''], code: ['', Validators.required], name: ['', Validators.required], location: ['', Validators.required] }); constructor() { void this.load(); } async load(): Promise<void> { try { this.catalogs.set(await this.api.catalogs()); } catch (e) { this.error.set(e instanceof Error ? e.message : 'No se pudo completar la acción. Inténtalo de nuevo.'); } } edit(k: any): void { this.editing.set(true); this.form.patchValue({ id: k.id, code: k.code, name: k.name, location: k.location }); } clear(): void { this.editing.set(false); this.form.reset({ id: '', code: '', name: '', location: '' }); } async save(): Promise<void> { try { await this.api.saveKiosk(Object.fromEntries(Object.entries(this.form.getRawValue()).filter(([, v]) => v !== ''))); this.message.set('Kiosko guardado.'); this.clear(); await this.load(); } catch (e) { this.error.set(e instanceof Error ? e.message : 'No se pudo completar la acción. Inténtalo de nuevo.'); } } async deactivate(kiosk: { id: string; name: string }): Promise<void> { const id = kiosk.id; if (!(await this.confirm.ask({ title: `¿Desactivar el kiosko ${kiosk.name}?`, message: 'No se podrá abrir sesión en él ni mostrar su QR.', confirmLabel: 'Desactivar' }))) { return; } try { await this.api.deactivateKiosk(id); this.message.set('Kiosko desactivado.'); await this.load(); } catch (e) { this.error.set(e instanceof Error ? e.message : 'No se pudo completar la acción. Inténtalo de nuevo.'); } } }
