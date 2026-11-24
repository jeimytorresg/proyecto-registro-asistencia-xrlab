import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BrowserCodeReader, BrowserQRCodeReader } from '@zxing/browser';
import { Camera, CircleCheck } from 'lucide-angular';
import { environment } from '../../../../environments/environment';
import type {
  AttendanceExitResponse,
  AttendanceScanResponse,
} from '../../../core/models/attendance.models';
import { AttendanceService } from '../../../core/services/attendance.service';
import { AuthService } from '../../../core/services/auth.service';
import { fmt } from '../../../shared/format';
import { Alert, Icon, Rings } from '../../../shared/ui';

interface ExitContext {
  qrToken: string;
  attendanceSessionId: string;
  entryAt: string | null;
}

@Component({
  selector: 'app-student-home',
  imports: [ReactiveFormsModule, Alert, Icon, Rings],
  templateUrl: './student-home.html',
  styleUrl: './student-home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentHome implements OnDestroy {
  @ViewChild('videoPreview') private videoPreview?: ElementRef<HTMLVideoElement>;

  readonly auth = inject(AuthService);
  readonly fmt = fmt;
  readonly icons = { camera: Camera, ok: CircleCheck };
  readonly showDevTools = !environment.production;
  readonly firstName = computed(() => this.auth.session()?.profile.firstName ?? '');

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

  /** Error del campo de actividades: solo después de intentar enviar. */
  readonly activitiesInvalid = signal(false);

  constructor() {
    // El aviso de campo vacío se quita en cuanto la persona empieza a escribir.
    this.activityForm.controls.activitiesText.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.activitiesInvalid.set(false));
  }

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
        throw new Error('No pudimos mostrar la cámara. Recarga la página e inténtalo de nuevo.');
      }

      const devices = await BrowserCodeReader.listVideoInputDevices();

      if (devices.length === 0) {
        throw new Error('No encontramos una cámara en este dispositivo.');
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
      this.error.set('Pega un token QR para probar el flujo local.');
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
      this.activitiesInvalid.set(true);
      return;
    }

    this.activitiesInvalid.set(false);

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
    this.activitiesInvalid.set(false);
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
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      return 'Permite el acceso a la cámara en tu navegador para escanear el QR.';
    }

    return error instanceof Error ? error.message : 'No se pudo procesar el QR escaneado. Inténtalo de nuevo.';
  }
}
