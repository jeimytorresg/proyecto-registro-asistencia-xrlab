import { afterNextRender, ChangeDetectionStrategy, Component, computed, inject, Injector, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Eye, EyeOff } from 'lucide-angular';
import { environment } from '../../../../environments/environment';
import { Alert, Icon, Rings } from '../../../shared/ui';
import type { UserRole } from '../../models/auth.models';
import { AuthService } from '../../services/auth.service';

/** email: pide el correo · password: ingreso normal · first-access: crear contraseña. */
type LoginStep = 'email' | 'password' | 'first-access';

interface DemoCredential {
  label: string;
  email: string;
  role: UserRole;
}

interface StepCopy {
  title: string;
  intro: string;
  submit: string;
  submitting: string;
}

/** Debe coincidir con la política del backend (functions/src/routes/auth.routes.ts). */
const PASSWORD_MIN_LENGTH = 8;

const STEP_COPY: Record<LoginStep, StepCopy> = {
  email: {
    title: 'Iniciar sesión',
    intro: 'Ingresa con tu correo institucional para continuar.',
    submit: 'Continuar',
    submitting: 'Verificando…',
  },
  password: {
    title: 'Iniciar sesión',
    intro: 'Escribe tu contraseña para acceder.',
    submit: 'Ingresar',
    submitting: 'Validando…',
  },
  'first-access': {
    title: 'Crea tu contraseña',
    intro: 'Es tu primer ingreso. Elige una contraseña para activar tu cuenta.',
    submit: 'Crear contraseña e ingresar',
    submitting: 'Guardando…',
  },
};

/** Devuelve el primer problema de la contraseña nueva, o null si cumple la política. */
function newPasswordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Usa al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (!/\p{L}/u.test(password)) {
    return 'Incluye al menos una letra.';
  }
  if (!/\d/.test(password)) {
    return 'Incluye al menos un número.';
  }
  return null;
}

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, Alert, Icon, Rings],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);

  readonly auth = inject(AuthService);

  readonly icons = { eye: Eye, eyeOff: EyeOff };
  readonly passwordMinLength = PASSWORD_MIN_LENGTH;
  readonly showDevUsers = !environment.production;
  readonly showPassword = signal(false);
  readonly step = signal<LoginStep>('email');
  readonly isSubmitting = signal(false);
  readonly submitted = signal(false);
  readonly error = signal<string | null>(null);
  readonly copy = computed(() => STEP_COPY[this.step()]);

  readonly demoCredentials: DemoCredential[] = [
    {
      label: 'Administrador',
      email: 'admin@xrlab.test',
      role: 'ADMIN',
    },
    {
      label: 'Docente',
      email: 'docente@xrlab.test',
      role: 'TEACHER',
    },
    {
      label: 'Estudiante',
      email: 'estudiante@xrlab.test',
      role: 'STUDENT',
    },
  ];

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    passwordConfirmation: [''],
  });

  // Se recalcula cuando cambia el valor, el estado o "tocado" de cualquier campo.
  private readonly formEvents = toSignal(this.form.events, { initialValue: null });

  readonly emailError = computed(() => {
    this.formEvents();
    const control = this.form.controls.email;
    if (!control.touched || control.valid) {
      return null;
    }
    return control.hasError('required')
      ? 'Escribe tu correo institucional.'
      : 'Revisa el formato del correo: nombre@dominio.com';
  });

  readonly passwordError = computed(() => {
    this.formEvents();
    if (!this.submitted()) {
      return null;
    }
    const { password } = this.form.getRawValue();
    if (this.step() === 'password') {
      return password ? null : 'Escribe tu contraseña.';
    }
    if (this.step() === 'first-access') {
      return password ? newPasswordProblem(password) : 'Elige una contraseña.';
    }
    return null;
  });

  readonly confirmationError = computed(() => {
    this.formEvents();
    if (!this.submitted() || this.step() !== 'first-access') {
      return null;
    }
    const { password, passwordConfirmation } = this.form.getRawValue();
    if (!passwordConfirmation) {
      return 'Repite la contraseña.';
    }
    return password === passwordConfirmation ? null : 'Las contraseñas no coinciden.';
  });

  useDemoCredential(credential: DemoCredential): void {
    this.form.setValue({
      email: credential.email,
      password: 'Xrlab.Dev.2026!',
      passwordConfirmation: '',
    });

    this.goToStep('password', false);
  }

  changeEmail(): void {
    this.form.patchValue({ password: '', passwordConfirmation: '' });
    this.goToStep('email');
  }

  async submit(): Promise<void> {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.controls.email.invalid) {
      this.form.controls.email.markAsTouched();
      return;
    }

    this.submitted.set(true);

    if (this.step() !== 'email' && (this.passwordError() || this.confirmationError())) {
      return;
    }

    this.isSubmitting.set(true);
    this.error.set(null);

    try {
      if (this.step() === 'email') {
        await this.resolveAccessStep();
        return;
      }

      await this.signIn();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private async resolveAccessStep(): Promise<void> {
    const status = await this.auth.getAccessStatus(this.form.controls.email.value);

    this.form.patchValue({ password: '', passwordConfirmation: '' });
    this.goToStep(status === 'FIRST_ACCESS' ? 'first-access' : 'password');
  }

  private async signIn(): Promise<void> {
    const { email, password, passwordConfirmation } = this.form.getRawValue();

    if (this.step() === 'first-access') {
      await this.auth.completeFirstAccess(email, password, passwordConfirmation);
      // La contraseña ya quedó guardada: si el ingreso falla, se reintenta como ingreso normal.
      this.step.set('password');
    }

    const session = await this.auth.login(email, password);
    const requestedReturnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

    await this.router.navigateByUrl(this.getTargetRoute(session.role, requestedReturnUrl));
  }

  private goToStep(step: LoginStep, focus = true): void {
    this.step.set(step);
    this.submitted.set(false);
    this.error.set(null);

    if (focus) {
      const fieldId = { email: 'email', password: 'password', 'first-access': 'new-password' }[step];
      afterNextRender(() => document.getElementById(fieldId)?.focus(), { injector: this.injector });
    }
  }

  private getTargetRoute(role: UserRole, returnUrl: string | null): string {
    if (returnUrl && this.isReturnUrlAllowedForRole(role, returnUrl)) {
      return returnUrl;
    }

    if (role === 'STUDENT') {
      return '/student';
    }

    return '/admin/dashboard';
  }

  private isReturnUrlAllowedForRole(role: UserRole, returnUrl: string): boolean {
    if (!returnUrl.startsWith('/')) {
      return false;
    }

    if (role === 'STUDENT') {
      return returnUrl.startsWith('/student');
    }

    if (role === 'ADMIN') {
      return returnUrl.startsWith('/admin') || returnUrl.startsWith('/kiosk');
    }

    return (
      returnUrl.startsWith('/admin/dashboard') ||
      returnUrl.startsWith('/admin/attendance') ||
      returnUrl.startsWith('/admin/students') ||
      returnUrl.startsWith('/kiosk')
    );
  }
}
