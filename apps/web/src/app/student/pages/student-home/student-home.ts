import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BrowserCodeReader, BrowserQRCodeReader } from '@zxing/browser';
import { environment } from '../../../../environments/environment';
import type {
  AttendanceExitResponse,
  AttendanceScanResponse,
} from '../../../core/models/attendance.models';
import { AttendanceService } from '../../../core/services/attendance.service';
import { AuthService } from '../../../core/services/auth.service';

interface ExitContext {
  qrToken: string;
  attendanceSessionId: string;
  entryAt: string | null;
}

@Component({
  selector: 'app-student-home',
  imports: [ReactiveFormsModule],
  template: `
    <section class="student-scan-layout">
      <article class="card hero-card">
        <p class="eyebrow">Estudiante · PC3</p>
        <h1>Escanear QR del kiosko</h1>
        <p class="lead">
          Si no tiene entrada abierta, se registra entrada. Si ya tiene entrada abierta,
          registre las actividades realizadas para confirmar la salida.
        </p>

        @if (auth.session(); as session) {
          <div class="success-box">
            Sesión estudiante: {{ session.profile.firstName }} {{ session.profile.lastName }}
            · {{ session.email }}
          </div>
        }

        @if (error(); as currentError) {
          <div class="error-box" role="alert">
            {{ currentError }}
          </div>
        }

        @if (result(); as scanResult) {
          <div [class]="scanResult.action === 'ENTRY_REGISTERED' ? 'success-box' : 'warning-box'">
            <strong>{{ scanResult.action }}</strong>
            <p>{{ scanResult.message }}</p>
            <small>Registro: {{ scanResult.attendanceSessionId }}</small>
          </div>
        }

        @if (exitResult(); as completedExit) {
          <div class="success-box">
            <strong>{{ completedExit.action }}</strong>
            <p>{{ completedExit.message }}</p>
            <p>Duración: {{ completedExit.durationMinutes }} minuto(s)</p>
            <small>Salida: {{ completedExit.exitAt }}</small>
          </div>
        }

        @if (exitContext(); as pendingExit) {
          <form class="form-grid activity-exit-form" [formGroup]="activityForm" (ngSubmit)="submitExit()">
            <h2>Registrar actividades realizadas</h2>
            <p class="lead">
              Escriba una actividad por línea. Este campo es obligatorio para confirmar la salida.
            </p>

            <div class="field">
              <label for="activitiesText">Actividades</label>
              <textarea
                id="activitiesText"
                rows="6"
                formControlName="activitiesText"
                placeholder="Ejemplo: Configuración de visor XR&#10;Prueba de aplicación de realidad virtual&#10;Documentación de evidencia"
              ></textarea>
            </div>

            <div class="actions">
              <button class="btn" type="submit" [disabled]="isSubmitting()">
                {{ isSubmitting() ? 'Registrando salida...' : 'Confirmar salida' }}
              </button>

              <button class="btn secondary" type="button" [disabled]="isSubmitting()" (click)="resetExitFlow()">
                Escanear otro QR
              </button>
            </div>

            <small>
              Entrada abierta: {{ pendingExit.entryAt ?? 'sin fecha visible' }}
            </small>
          </form>
        } @else {
          <div class="scanner-frame">
            <video #videoPreview muted playsinline></video>

            @if (!cameraActive()) {
              <div class="scanner-placeholder">
                Cámara detenida
              </div>
            }
          </div>

          <div class="actions">
            <button class="btn" type="button" [disabled]="isSubmitting()" (click)="startScanner()">
              Iniciar cámara
            </button>

            <button class="btn secondary" type="button" (click)="stopScanner()">
              Detener cámara
            </button>
          </div>

          @if (!environment.production) {
            <form class="form-grid dev-token-form" [formGroup]="manualForm" (ngSubmit)="submitManualToken()">
              <div class="field">
                <label for="manualQrToken">Token QR para prueba local</label>
                <textarea
                  id="manualQrToken"
                  rows="4"
                  formControlName="qrToken"
                  placeholder="Pegue aquí el token copiado desde el kiosko"
                ></textarea>
              </div>

              <button class="btn secondary" type="submit" [disabled]="isSubmitting()">
                Enviar token pegado
              </button>
            </form>
          }
        }
      </article>

      <aside class="card">
        <h2>Estado del flujo</h2>
        <ul class="status-list">
          <li>Sin entrada abierta: se crea una sesión OPEN.</li>
          <li>Con entrada abierta: se solicita actividades.</li>
          <li>Salida sin actividades: bloqueada.</li>
          <li>Salida exitosa: sesión pasa a COMPLETED.</li>
          <li>Después de entrada o salida exitosa, se cierra la sesión móvil.</li>
        </ul>
      </aside>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentHome implements OnDestroy {
  @ViewChild('videoPreview') private videoPreview?: ElementRef<HTMLVideoElement>;

  readonly auth = inject(AuthService);
  readonly environment = environment;

  private readonly attendanceService = inject(AttendanceService);
  private readonly fb = inject(FormBuilder);
  private readonly codeReader = new BrowserQRCodeReader();

  readonly cameraActive = signal(false);
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<AttendanceScanResponse | null>(null);
  readonly exitResult = signal<AttendanceExitResponse | null>(null);
  readonly exitContext = signal<ExitContext | null>(null);

  readonly manualForm = this.fb.nonNullable.group({
    qrToken: [''],
  });

  readonly activityForm = this.fb.nonNullable.group({
    activitiesText: ['', [Validators.required]],
  });

  private scannerControls: { stop: () => void } | null = null;
  private lastScannedToken = '';

  ngOnDestroy(): void {
    this.stopScanner();
  }

  async startScanner(): Promise<void> {
    if (this.cameraActive() || this.isSubmitting()) {
      return;
    }

    this.error.set(null);
    this.result.set(null);
    this.exitResult.set(null);

    try {
      const videoElement = this.videoPreview?.nativeElement;

      if (!videoElement) {
        throw new Error('No se encontró el elemento de video para la cámara.');
      }

      const devices = await BrowserCodeReader.listVideoInputDevices();

      if (devices.length === 0) {
        throw new Error('No se encontró una cámara disponible.');
      }

      const preferredDevice =
        devices.find((device) => /back|rear|environment/i.test(device.label)) ??
        devices[0];

      this.scannerControls = await this.codeReader.decodeFromVideoDevice(
        preferredDevice.deviceId,
        videoElement,
        (scanResult) => {
          const text = scanResult?.getText();

          if (text) {
            void this.handleScannedToken(text);
          }
        },
      );

      this.cameraActive.set(true);
    } catch (error) {
      this.cameraActive.set(false);
      this.error.set(this.getErrorMessage(error));
    }
  }

  stopScanner(): void {
    this.scannerControls?.stop();
    this.scannerControls = null;
    this.cameraActive.set(false);
  }

  async submitManualToken(): Promise<void> {
    const token = this.manualForm.controls.qrToken.value.trim();

    if (!token) {
      this.error.set('Pegue un token QR para probar el flujo local.');
      return;
    }

    await this.handleScannedToken(token);
  }

  async submitExit(): Promise<void> {
    const pendingExit = this.exitContext();

    if (!pendingExit || this.isSubmitting()) {
      return;
    }

    const activities = this.activityForm.controls.activitiesText.value
      .split(/\r?\n/)
      .map((activity) => activity.trim())
      .filter((activity) => activity.length > 0);

    if (activities.length === 0) {
      this.error.set('Debe registrar al menos una actividad para confirmar la salida.');
      return;
    }

    this.isSubmitting.set(true);
    this.error.set(null);

    try {
      const completedExit = await this.attendanceService.registerExit({
        qrToken: pendingExit.qrToken,
        attendanceSessionId: pendingExit.attendanceSessionId,
        activities,
      });

      this.exitResult.set(completedExit);
      this.exitContext.set(null);
      this.result.set(null);

      window.setTimeout(() => {
        void this.auth.logout();
      }, 2600);
    } catch (error) {
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  resetExitFlow(): void {
    this.exitContext.set(null);
    this.result.set(null);
    this.exitResult.set(null);
    this.error.set(null);
    this.activityForm.reset({
      activitiesText: '',
    });
    this.lastScannedToken = '';
  }

  private async handleScannedToken(token: string): Promise<void> {
    if (this.isSubmitting() || token === this.lastScannedToken) {
      return;
    }

    this.isSubmitting.set(true);
    this.lastScannedToken = token;
    this.error.set(null);
    this.result.set(null);
    this.exitResult.set(null);

    try {
      const response = await this.attendanceService.scanQr(token);

      this.result.set(response);

      if (response.action === 'ENTRY_REGISTERED') {
        this.stopScanner();

        window.setTimeout(() => {
          void this.auth.logout();
        }, 2200);

        return;
      }

      if (response.action === 'EXIT_REQUIRES_ACTIVITIES') {
        this.stopScanner();
        this.activityForm.reset({
          activitiesText: '',
        });

        this.exitContext.set({
          qrToken: token,
          attendanceSessionId: response.attendanceSessionId,
          entryAt: response.entryAt,
        });
      }
    } catch (error) {
      this.lastScannedToken = '';
      this.error.set(this.getErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error
      ? error.message
      : 'No se pudo procesar el QR escaneado.';
  }
}
