import { inject, Injectable } from '@angular/core';
import type { ApiResponse } from '../models/auth.models';
import type {
  KioskCloseResponse,
  KioskOpenResponse,
  QrBatchResponse,
} from '../models/kiosk.models';
import { ApiClientService } from './api-client.service';

@Injectable({
  providedIn: 'root',
})
export class KioskService {
  private readonly api = inject(ApiClientService);

  async openSession(kioskCode = 'XR-KIOSK-01'): Promise<KioskOpenResponse> {
    const response = await this.api.post<KioskOpenResponse, { kioskCode: string }>(
      '/kiosk/sessions/open',
      { kioskCode },
    );

    return this.unwrap(response);
  }

  async closeSession(kioskSessionId: string): Promise<KioskCloseResponse> {
    const response = await this.api.post<
      KioskCloseResponse,
      { kioskSessionId: string }
    >('/kiosk/sessions/close', { kioskSessionId });

    return this.unwrap(response);
  }

  async getQrBatch(kioskSessionId: string): Promise<QrBatchResponse> {
    const response = await this.api.post<
      QrBatchResponse,
      { kioskSessionId: string; batchSeconds: number }
    >('/kiosk/qr/batch', {
      kioskSessionId,
      batchSeconds: 60,
    });

    return this.unwrap(response);
  }

  private unwrap<T>(response: ApiResponse<T>): T {
    if (!response.ok) {
      throw new Error(response.error.message);
    }

    return response.data;
  }
}
