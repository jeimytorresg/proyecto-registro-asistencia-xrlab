import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import type { UserRole } from '../../models/auth.models';
import { AuthService } from '../../services/auth.service';

interface DemoCredential {
  label: string;
  email: string;
  role: UserRole;
}

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  template: `
    <section class="placeholder-layout">
      <article class="card hero-card">
        <p class="eyebrow">PC1 · Autenticación y roles</p>
        <h1>Inicio de sesión XRLAB</h1>
        <p class="lead">
          Acceso con Firebase Authentication, perfil extendido en PostgreSQL y
          validación de rol en backend antes de entrar a rutas protegidas.
        </p>

        <form class="form-grid" [formGroup]="form" (ngSubmit)="submit()">
          <div class="field">
            <label for="email">Correo institucional</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              autocomplete="email"
              placeholder="usuario@xrlab.test"
            />
          </div>

          <div class="field">
            <label for="password">Contraseña</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              autocomplete="current-password"
              placeholder="Ingrese su contraseña"
            />
          </div>

          @if (error(); as currentError) {
            <div class="error-box" role="alert">
              {{ currentError }}
            </div>
          }

          @if (auth.state().status === 'authenticated') {
            <div class="success-box">
              Sesión validada correctamente.
            </div>
          }

          <div class="actions">
            <button class="btn" type="submit" [disabled]="isSubmitting()">
              {{ isSubmitting() ? 'Validando...' : 'Ingresar' }}
            </button>
          </div>
        </form>
      </article>

      <aside class="card">
        <h2>Usuarios de desarrollo</h2>
        <p class="lead">
          Estos usuarios existen solo en Firebase Auth Emulator.
        </p>

        <div class="demo-credentials">
          @for (credential of demoCredentials; track credential.email) {
            <div class="demo-credential">
              <span>
                <strong>{{ credential.label }}</strong>
                <small>{{ credential.email }}</small>
              </span>

              <button
                class="link-button"
                type="button"
                (click)="useDemoCredential(credential)"
              >
                Usar
              </button>
            </div>
          }
        </div>

        <p class="warning-box" style="margin-top: 1rem;">
          Clave común: Xrlab.Dev.2026!
        </p>
      </aside>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly auth = inject(AuthService);

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

  useDemoCredential(credential: DemoCredential): void {
    this.form.setValue({
      email: credential.email,
      password: 'Xrlab.Dev.2026!',
    });

    this.error.set(null);
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting()) {
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
