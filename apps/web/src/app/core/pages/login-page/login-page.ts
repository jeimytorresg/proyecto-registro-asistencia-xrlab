import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Eye, EyeOff } from 'lucide-angular';
import { environment } from '../../../../environments/environment';
import { Alert, Icon, Rings } from '../../../shared/ui';
import type { UserRole } from '../../models/auth.models';
import { AuthService } from '../../services/auth.service';

interface DemoCredential {
  label: string;
  email: string;
  role: UserRole;
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

  readonly auth = inject(AuthService);

  readonly icons = { eye: Eye, eyeOff: EyeOff };
  readonly showDevUsers = !environment.production;
  readonly showPassword = signal(false);
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);

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
    password: ['', [Validators.required]],
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
    const control = this.form.controls.password;
    return control.touched && control.invalid ? 'Escribe tu contraseña.' : null;
  });

  useDemoCredential(credential: DemoCredential): void {
    this.form.setValue({
      email: credential.email,
      password: 'Xrlab.Dev.2026!',
    });

    this.error.set(null);
  }

  async submit(): Promise<void> {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.error.set(null);

    try {
      const session = await this.auth.login(
        this.form.controls.email.value,
        this.form.controls.password.value,
      );

      const requestedReturnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      const target = this.getTargetRoute(session.role, requestedReturnUrl);

      await this.router.navigateByUrl(target);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      this.isSubmitting.set(false);
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
