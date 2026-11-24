import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { AuditListResult } from '../../../core/models/admin-pc4.models';
import { Alert, EmptyState } from '../../../shared/ui';
import { fmt } from '../../../shared/format';
import { AdminPc4Service } from '../../../core/services/admin-pc4.service';

@Component({ selector: 'app-admin-audit', imports: [ReactiveFormsModule, Alert, EmptyState], templateUrl: './admin-audit.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class AdminAudit {
  readonly fmt = fmt;
 private readonly api = inject(AdminPc4Service); private readonly fb = inject(FormBuilder); readonly result = signal<AuditListResult | null>(null); readonly error = signal<string | null>(null); readonly form = this.fb.nonNullable.group({ actor: [''], action: [''], entityType: [''], source: [''] }); constructor() { void this.load(); } async load(): Promise<void> { try { const raw = this.form.getRawValue(); const params = Object.fromEntries(Object.entries(raw).filter(([, v]) => !!v)) as Record<string, string>; this.result.set(await this.api.audit(params)); } catch (e) { this.error.set(e instanceof Error ? e.message : 'Error'); } } }
