import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../models/auth.models';
import type {
  AdminCatalogs,
  AttendanceListResult,
  AuditListResult,
  CatalogItem,
  CatalogKiosk,
  CatalogPeriod,
  CatalogStudent,
  CatalogTeacher,
  InvitationResult,
} from '../models/admin-pc4.models';
import { ApiClientService } from './api-client.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AdminPc4Service {
  private readonly api = inject(ApiClientService);
  private readonly auth = inject(AuthService);

  async catalogs(): Promise<AdminCatalogs> {
    return this.unwrap(await this.api.get<AdminCatalogs>('/admin/catalogs'));
  }

  async attendance(params: Record<string, string> = {}): Promise<AttendanceListResult> {
    const query = new URLSearchParams(params).toString();
    return this.unwrap(await this.api.get<AttendanceListResult>(`/admin/attendance${query ? `?${query}` : ''}`));
  }

  async audit(params: Record<string, string> = {}): Promise<AuditListResult> {
    const query = new URLSearchParams(params).toString();
    return this.unwrap(await this.api.get<AuditListResult>(`/admin/audit-logs${query ? `?${query}` : ''}`));
  }

  async saveCareer(name: string): Promise<CatalogItem> {
    return this.unwrap(await this.api.post<CatalogItem, { name: string }>('/admin/careers', { name }));
  }

  async savePracticeType(name: string): Promise<CatalogItem> {
    return this.unwrap(await this.api.post<CatalogItem, { name: string }>('/admin/practice-types', { name }));
  }

  async saveStudent(body: Record<string, unknown>): Promise<CatalogStudent & InvitationResult> {
    return this.unwrap(await this.api.post<CatalogStudent & InvitationResult, Record<string, unknown>>('/admin/students', body));
  }

  async inviteStudent(id: string): Promise<string> {
    return this.sendInvitation(`/admin/students/${id}/invitation`);
  }

  async deactivateStudent(id: string): Promise<{ id: string; active: boolean }> {
    return this.unwrap(await this.api.post<{ id: string; active: boolean }, Record<string, never>>(`/admin/students/${id}/deactivate`, {}));
  }

  async saveTeacher(body: Record<string, unknown>): Promise<CatalogTeacher & { invitationPending: boolean }> {
    return this.unwrap(await this.api.post<CatalogTeacher & { invitationPending: boolean }, Record<string, unknown>>('/admin/teachers', body));
  }

  async inviteTeacher(id: string): Promise<string> {
    return this.sendInvitation(`/admin/teachers/${id}/invitation`);
  }

  /** Envía el correo de invitación si la cuenta aún no tiene contraseña. */
  async sendInvitationIfPending(result: InvitationResult): Promise<boolean> {
    if (!result.invitationPending) {
      return false;
    }
    await this.auth.sendInvitationEmail(result.email);
    return true;
  }

  async deactivateTeacher(id: string): Promise<{ id: string; active: boolean }> {
    return this.unwrap(await this.api.post<{ id: string; active: boolean }, Record<string, never>>(`/admin/teachers/${id}/deactivate`, {}));
  }

  async savePeriod(body: Record<string, unknown>): Promise<CatalogPeriod> {
    return this.unwrap(await this.api.post<CatalogPeriod, Record<string, unknown>>('/admin/periods', body));
  }

  async activatePeriod(id: string): Promise<CatalogPeriod> {
    return this.unwrap(await this.api.post<CatalogPeriod, Record<string, never>>(`/admin/periods/${id}/activate`, {}));
  }

  async closePeriod(id: string): Promise<{ id: string; isActive: boolean }> {
    return this.unwrap(await this.api.post<{ id: string; isActive: boolean }, Record<string, never>>(`/admin/periods/${id}/close`, {}));
  }

  async saveKiosk(body: Record<string, unknown>): Promise<CatalogKiosk> {
    return this.unwrap(await this.api.post<CatalogKiosk, Record<string, unknown>>('/admin/kiosks', body));
  }

  async deactivateKiosk(id: string): Promise<{ id: string; active: boolean }> {
    return this.unwrap(await this.api.post<{ id: string; active: boolean }, Record<string, never>>(`/admin/kiosks/${id}/deactivate`, {}));
  }

  async manualRecord(body: Record<string, unknown>): Promise<{ id: string; status: string; source: string; durationMinutes: number }> {
    return this.unwrap(await this.api.post<{ id: string; status: string; source: string; durationMinutes: number }, Record<string, unknown>>('/admin/manual-records', body));
  }

  async voidIncompleteSessions(): Promise<{ voided: number; ids: string[] }> {
    return this.unwrap(await this.api.post<{ voided: number; ids: string[] }, Record<string, never>>('/admin/jobs/void-incomplete-sessions', {}));
  }

  async exportAttendance(params: Record<string, string> = {}): Promise<void> {
    const token = await this.auth.getIdToken();
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${environment.apiBaseUrl}/admin/attendance/export${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'No se pudo exportar el Excel.');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `xrlab-asistencias-${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private async sendInvitation(path: string): Promise<string> {
    const result = this.unwrap(await this.api.post<InvitationResult, Record<string, never>>(path, {}));
    await this.auth.sendInvitationEmail(result.email);
    return result.email;
  }

  private unwrap<T>(response: ApiResponse<T>): T {
    if (!response.ok) {
      throw new Error(response.error.message);
    }
    return response.data;
  }
}
