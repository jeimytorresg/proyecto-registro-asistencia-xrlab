import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../models/auth.models';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class ApiClientService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  async get<T>(path: string): Promise<ApiResponse<T>> {
    const token = await this.auth.getIdToken();

    try {
      return await firstValueFrom(
        this.http.get<ApiResponse<T>>(this.buildUrl(path), {
          headers: this.buildAuthHeaders(token),
        }),
      );
    } catch (error) {
      throw this.mapHttpError(error);
    }
  }

  async post<TResponse, TBody extends object>(
    path: string,
    body: TBody,
  ): Promise<ApiResponse<TResponse>> {
    const token = await this.auth.getIdToken();

    try {
      return await firstValueFrom(
        this.http.post<ApiResponse<TResponse>>(this.buildUrl(path), body, {
          headers: this.buildAuthHeaders(token),
        }),
      );
    } catch (error) {
      throw this.mapHttpError(error);
    }
  }

  private buildUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    return `${environment.apiBaseUrl}${normalizedPath}`;
  }

  private buildAuthHeaders(token: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  private mapHttpError(error: unknown): Error {
    if (error instanceof HttpErrorResponse) {
      const message =
        error.error?.error?.message ??
        error.error?.message ??
        'No se pudo completar la solicitud al backend.';

      return new Error(message);
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error('No se pudo completar la solicitud al backend.');
  }
}
