import { inject, Injectable } from '@angular/core';
import type {
  AttendanceListFilters,
  AttendanceListResult,
  DashboardSummary,
} from '../models/admin.models';
import type { ApiResponse } from '../models/auth.models';
import { ApiClientService } from './api-client.service';

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private readonly api = inject(ApiClientService);

  async getAttendance(filters: AttendanceListFilters = {}): Promise<AttendanceListResult> {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        query.set(key, String(value));
      }
    }

    const path = query.size > 0
      ? `/admin/attendance?${query.toString()}`
      : '/admin/attendance';

    const response = await this.api.get<AttendanceListResult>(path);

    return this.unwrap(response);
  }

  async getDashboard(): Promise<DashboardSummary> {
    const response = await this.api.get<DashboardSummary>('/admin/dashboard');

    return this.unwrap(response);
  }

  private unwrap<T>(response: ApiResponse<T>): T {
    if (!response.ok) {
      throw new Error(response.error.message);
    }

    return response.data;
  }
}
