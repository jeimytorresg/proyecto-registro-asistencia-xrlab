import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import * as QRCode from 'qrcode';
import { environment } from '../../../../environments/environment';
import type {
  KioskSessionInfo,
  QrBatchResponse,
  QrBatchToken,
} from '../../../core/models/kiosk.models';
import { AuthService } from '../../../core/services/auth.service';
import { KioskService } from '../../../core/services/kiosk.service';

@Component({
  selector: 'app-kiosk-home',
  template: `
    <section class="kiosk-layout">
      <article class="card hero-card kiosk-main-card">
        <p class="eyebrow">Kiosko · PC2</p>
        <h1>QR temporal firmado</h1>
        <p class="lead">
          Esta pantalla solo puede ser usada por ADMIN o TEACHER. El QR se genera
          en backend, rota cada 10 segundos y expira rápidamente.
        </p>

        @if (auth.session(); as session) {
          <div class="success-box">
            Kiosko operado por {{ session.profile.firstName }} {{ session.profile.lastName }}
            · {{ session.role }}
          </div>
        }

        @if (error(); as currentError) {
          <div class="error-box" role="alert">
            {{ currentError }}
          </div>
        }

        @if (statusMessage(); as message) {
          <div class="warning-box">
            {{ message }}
          </div>
        }

        @if (!session()) {
          <div class="actions">
            <button class="btn" type="button" [disabled]="isBusy()" (click)="openKiosk()">
              {{ isBusy() ? 'Abriendo...' : 'Abrir sesión de kiosko' }}
            </button>
          </div>
        }

        @if (session(); as kioskSession) {
          <div class="kiosk-session-panel">
            <div>
              <strong>Sesión activa</strong>
              <span>{{ kioskSession.kiosk.code }} · {{ kioskSession.kiosk.name }}</span>
              <small>{{ kioskSession.kiosk.location }}</small>
            </div>

            <div>
              <strong>Inicio</strong>
              <span>{{ kioskSession.openedAt }}</span>
            </div>
          </div>

          <div class="qr-display">
            @if (currentQrDataUrl(); as qrDataUrl) {
              <img [src]="qrDataUrl" alt="Código QR temporal XRLAB" />
            } @else {
              <div class="qr-placeholder">
                Generando QR...
              </div>
            }
          </div>

          @if (currentToken(); as token) {
            <div class="kiosk-session-panel">
              <div>
                <strong>Secuencia</strong>
                <span>{{ token.seq }}</span>
              </div>

              <div>
                <strong>Válido desde</strong>
                <span>{{ token.validFrom }}</span>
              </div>

              <div>
                <strong>Expira</strong>
                <span>{{ token.expiresAt }}</span>
              </div>
            </div>

            @if (!environment.production) {
              <div class="actions">
                <button class="btn secondary" type="button" (click)="copyCurrentToken()">
                  Copiar token actual para prueba local
                </button>
              </div>
            }
          }

          <div class="actions">
            <button class="btn secondary" type="button" [disabled]="isBusy()" (click)="refreshBatch()">
              Renovar lote QR
            </button>

            <button class="btn secondary" type="button" [disabled]="isBusy()" (click)="closeKiosk()">
              Cerrar sesión de kiosko
            </button>
          </div>
        }
      </article>

      <aside class="card">
        <h2>Validación PC2</h2>
        <ul class="status-list">
          <li>QR_SIGNING_KEY no está en Angular.</li>
          <li>El QR viene firmado desde backend.</li>
          <li>El kiosko solo abre con ADMIN o TEACHER.</li>
          <li>El estudiante no puede entrar a esta pantalla.</li>
          <li>El token expira y se valida en backend.</li>
        </ul>
      </aside>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KioskHome implements OnDestroy {
  readonly auth = inject(AuthService);
  readonly environment = environment;

  private readonly kioskService = inject(KioskService);

  readonly session = signal<KioskSessionInfo | null>(null);
  readonly batch = signal<QrBatchResponse | null>(null);
  readonly currentToken = signal<QrBatchToken | null>(null);
  readonly currentQrDataUrl = signal<string | null>(null);
  readonly statusMessage = signal('Abra una sesión de kiosko para iniciar la rotación QR.');
  readonly error = signal<string | null>(null);
  readonly isBusy = signal(false);

  private rotationTimer: ReturnType<typeof setInterval> | null = null;
  private lastRenderedToken = '';
  private isRefreshingBatch = false;

  ngOnDestroy(): void {
    this.stopRotation();
  }

  async openKiosk(): Promise<void> {
    if (this.isBusy()) {
      return;
    }

    this.isBusy.set(true);
    this.error.set(null);

    try {
      const result = await this.kioskService.openSession('XR-KIOSK-01');

      this.session.set(result.session);
      this.statusMessage.set(
        result.reused
          ? 'Se reutilizó una sesión activa de kiosko.'
          : 'Sesión de kiosko abierta correctamente.',
      );

      await this.refreshBatch();
      this.startRotation();
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.isBusy.set(false);
    }
  }

  async closeKiosk(): Promise<void> {
    const currentSession = this.session();

    if (!currentSession || this.isBusy()) {
      return;
    }

    this.isBusy.set(true);
    this.error.set(null);

    try {
      await this.kioskService.closeSession(currentSession.id);

      this.stopRotation();
      this.session.set(null);
      this.batch.set(null);
      this.currentToken.set(null);
      this.currentQrDataUrl.set(null);
      this.lastRenderedToken = '';
      this.statusMessage.set('Sesión de kiosko cerrada.');
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.isBusy.set(false);
    }
  }

  async refreshBatch(): Promise<void> {
    const currentSession = this.session();

    if (!currentSession || this.isRefreshingBatch) {
      return;
    }

    this.isRefreshingBatch = true;
    this.error.set(null);

    try {
      const batch = await this.kioskService.getQrBatch(currentSession.id);

      this.batch.set(batch);
      this.statusMessage.set(
        `Lote QR recibido. Rotación cada ${batch.rotateEverySeconds} segundos.`,
      );

      await this.rotateQr();
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.isRefreshingBatch = false;
    }
  }

  async copyCurrentToken(): Promise<void> {
    const token = this.currentToken()?.token;

    if (!token) {
      return;
    }

    await navigator.clipboard.writeText(token);
    this.statusMessage.set('Token copiado. Use esto solo para pruebas locales.');
  }

  private startRotation(): void {
    this.stopRotation();

    this.rotationTimer = setInterval(() => {
      void this.rotateQr();
    }, 1000);
  }

  private stopRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
  }

  private async rotateQr(): Promise<void> {
    await this.ensureBatchFresh();

    const token = this.findCurrentValidToken();

    if (!token) {
      this.currentToken.set(null);
      this.currentQrDataUrl.set(null);
      this.statusMessage.set('No hay QR vigente. Renovando lote...');
      return;
    }

    if (token.token === this.lastRenderedToken) {
      return;
    }

    this.currentToken.set(token);
    this.lastRenderedToken = token.token;

    this.currentQrDataUrl.set(
      await QRCode.toDataURL(token.token, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 430,
      }),
    );

    this.statusMessage.set('QR vigente y listo para escaneo.');
  }

  private async ensureBatchFresh(): Promise<void> {
    const tokens = this.batch()?.tokens ?? [];

    if (!this.session() || tokens.length === 0) {
      return;
    }

    const lastToken = tokens[tokens.length - 1];
    const lastExpirationMs = Date.parse(lastToken.expiresAt);
    const nowMs = Date.now();

    if (lastExpirationMs - nowMs < 20000) {
      await this.refreshBatch();
    }
  }

  private findCurrentValidToken(): QrBatchToken | null {
    const tokens = this.batch()?.tokens ?? [];
    const nowMs = Date.now();

    return (
      tokens.find((token) => {
        const validFromMs = Date.parse(token.validFrom);
        const expiresAtMs = Date.parse(token.expiresAt);

        return validFromMs <= nowMs && expiresAtMs > nowMs;
      }) ?? null
    );
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error
      ? error.message
      : 'No se pudo completar la operación del kiosko.';
  }
}
