import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { Copy, Maximize, Minimize, Power, RefreshCw } from 'lucide-angular';
import * as QRCode from 'qrcode';
import { environment } from '../../../../environments/environment';
import type {
  KioskSessionInfo,
  QrBatchResponse,
  QrBatchToken,
} from '../../../core/models/kiosk.models';
import { AuthService } from '../../../core/services/auth.service';
import { KioskService } from '../../../core/services/kiosk.service';
import { Alert, Icon, Rings } from '../../../shared/ui';

@Component({
  selector: 'app-kiosk-home',
  imports: [Alert, Icon, Rings],
  templateUrl: './kiosk-home.html',
  styleUrl: './kiosk-home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KioskHome implements OnDestroy {
  readonly auth = inject(AuthService);
  readonly showDevTools = !environment.production;
  readonly icons = { maximize: Maximize, minimize: Minimize, refresh: RefreshCw, copy: Copy, power: Power };

  private readonly kioskService = inject(KioskService);

  readonly session = signal<KioskSessionInfo | null>(null);
  readonly batch = signal<QrBatchResponse | null>(null);
  readonly currentToken = signal<QrBatchToken | null>(null);
  readonly currentQrDataUrl = signal<string | null>(null);
  readonly statusMessage = signal('');
  /** Ventana del QR actual: alimenta la animación del marco de cuenta regresiva. */
  readonly tokenWindow = signal<{ jti: string; durationMs: number; elapsedMs: number } | null>(null);
  readonly secondsLeft = signal<number | null>(null);
  readonly isFullscreen = signal(false);
  readonly error = signal<string | null>(null);
  readonly isBusy = signal(false);

  private rotationTimer: ReturnType<typeof setInterval> | null = null;
  private lastRenderedToken = '';
  private isRefreshingBatch = false;

  ngOnDestroy(): void {
    this.stopRotation();
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreen.set(!!document.fullscreenElement);
  }

  async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // El navegador puede negar la pantalla completa; el kiosko sigue funcionando.
    }
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
      this.statusMessage.set('');

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
      this.tokenWindow.set(null);
      this.secondsLeft.set(null);
      this.statusMessage.set('Cerraste la sesión del kiosko.');
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
    this.statusMessage.set('');
  }

  private startRotation(): void {
    this.stopRotation();

    // Se revisa varias veces por segundo para que el QR cambie justo cuando el anillo termina.
    this.rotationTimer = setInterval(() => {
      void this.rotateQr();
    }, 250);
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
      this.tokenWindow.set(null);
      this.secondsLeft.set(null);
      this.statusMessage.set('Renovando el QR…');
      return;
    }

    const nowMs = Date.now();
    const rotateMs = (this.batch()?.rotateEverySeconds ?? 10) * 1000;
    const validFromMs = Date.parse(token.validFrom);
    this.secondsLeft.set(Math.max(0, Math.ceil((validFromMs + rotateMs - nowMs) / 1000)));

    if (token.token === this.lastRenderedToken) {
      return;
    }

    this.currentToken.set(token);
    this.lastRenderedToken = token.token;
    // El anillo dura lo que dura la ventana de rotación y arranca completo en cada QR.
    this.tokenWindow.set({
      jti: token.jti,
      durationMs: rotateMs,
      elapsedMs: Math.min(rotateMs, Math.max(0, nowMs - validFromMs)),
    });

    this.currentQrDataUrl.set(
      await QRCode.toDataURL(token.token, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 640,
      }),
    );

    this.statusMessage.set('');
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

  /**
   * El QR a mostrar es el de la ventana actual: el más reciente que ya empezó y sigue vigente.
   * Cada token vale más tiempo (ttl) que el intervalo de rotación, así que se solapan;
   * mostrar el más antiguo alargaba el primer QR y desfasaba la cuenta regresiva de los siguientes.
   */
  private findCurrentValidToken(): QrBatchToken | null {
    const tokens = this.batch()?.tokens ?? [];
    const nowMs = Date.now();
    let current: QrBatchToken | null = null;

    for (const token of tokens) {
      const validFromMs = Date.parse(token.validFrom);
      const expiresAtMs = Date.parse(token.expiresAt);

      if (validFromMs <= nowMs && expiresAtMs > nowMs) {
        current = token;
      }
    }

    return current;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error
      ? error.message
      : 'No se pudo completar la operación del kiosko. Inténtalo de nuevo.';
  }
}
