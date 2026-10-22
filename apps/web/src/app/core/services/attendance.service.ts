import { inject, Injectable } from '@angular/core';
import type {
  AttendanceExitResponse,
  AttendanceScanResponse,
} from '../models/attendance.models';
import type { ApiResponse } from '../models/auth.models';
import { ApiClientService } from './api-client.service';

interface AttendanceScanBody {
  qrToken: string;
  clientInfo: {
    userAgent: string;
    timezone: string;
  };
}

interface AttendanceExitBody {
  qrToken: string;
  attendanceSessionId: string;
  activities: string[];
  clientInfo: {
    userAgent: string;
    timezone: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AttendanceService {
  private readonly api = inject(ApiClientService);

  async scanQr(qrToken: string): Promise<AttendanceScanResponse> {
    const response = await this.api.post<
      AttendanceScanResponse,
      AttendanceScanBody
    >('/attendance/scan', {
      qrToken,
      clientInfo: this.buildClientInfo(),
    });

    return this.unwrap(response);
  }

  async registerExit(params: {
    qrToken: string;
    attendanceSessionId: string;
    activities: string[];
  }): Promise<AttendanceExitResponse> {
    const response = await this.api.post<
      AttendanceExitResponse,
      AttendanceExitBody
    >('/attendance/exit', {
      qrToken: params.qrToken,
      attendanceSessionId: params.attendanceSessionId,
      activities: params.activities,
      clientInfo: this.buildClientInfo(),
    });

    return this.unwrap(response);
  }

  private buildClientInfo(): {
    userAgent: string;
    timezone: string;
  } {
    const timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Guayaquil';

    return {
      userAgent: navigator.userAgent,
      timezone,
    };
  }

  private unwrap<T>(response: ApiResponse<T>): T {
    if (!response.ok) {
      throw new Error(response.error.message);
    }

    return response.data;
  }
}
