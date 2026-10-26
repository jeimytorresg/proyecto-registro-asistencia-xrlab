import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse, AuthSession } from '../models/auth.models';

type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'error';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  session: AuthSession | null;
  error: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private firebaseAuth: Auth | null = null;
  private emulatorConfigured = false;

  private readonly stateSignal = signal<AuthState>({
    status: 'loading',
    user: null,
    session: null,
    error: null,
  });

  private authReadyResolver: (() => void) | null = null;

  private readonly authReadyPromise = new Promise<void>((resolve) => {
    this.authReadyResolver = resolve;
  });

  readonly state = this.stateSignal.asReadonly();

  readonly session = computed(() => this.state().session);

  readonly role = computed(() => this.state().session?.role ?? null);

  readonly isAuthenticated = computed(
    () => this.state().status === 'authenticated' && !!this.state().session,
  );

  constructor() {
    this.initializeAuthListenerSafely();
  }

  async waitUntilReady(): Promise<void> {
    await this.authReadyPromise;
  }

  async login(email: string, password: string): Promise<AuthSession> {
    this.stateSignal.set({
      status: 'loading',
      user: null,
      session: null,
      error: null,
    });

    try {
      const auth = this.getFirebaseAuth();

      const credentials = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      const session = await this.fetchSession(credentials.user, true);

      this.stateSignal.set({
        status: 'authenticated',
        user: credentials.user,
        session,
        error: null,
      });

      return session;
    } catch (error) {
      await this.signOutSilently();

      const message = this.mapAuthError(error);

      this.stateSignal.set({
        status: 'error',
        user: null,
        session: null,
        error: message,
      });

      throw new Error(message);
    }
  }

  async logout(): Promise<void> {
    await this.signOutSilently();

    this.stateSignal.set({
      status: 'anonymous',
      user: null,
      session: null,
      error: null,
    });

    await this.router.navigate(['/login']);
  }

  async refreshSession(forceRefresh = false): Promise<AuthSession | null> {
    const auth = this.getFirebaseAuth();
    const user = auth.currentUser;

    if (!user) {
      this.stateSignal.set({
        status: 'anonymous',
        user: null,
        session: null,
        error: null,
      });

      return null;
    }

    const session = await this.fetchSession(user, forceRefresh);

    this.stateSignal.set({
      status: 'authenticated',
      user,
      session,
      error: null,
    });

    return session;
  }

  async getIdToken(forceRefresh = false): Promise<string> {
    const auth = this.getFirebaseAuth();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('Debe iniciar sesión para obtener un token.');
    }

    return user.getIdToken(forceRefresh);
  }

  /** Envía el correo de Firebase para que el usuario defina su contraseña. */
  async sendInvitationEmail(email: string): Promise<void> {
    await sendPasswordResetEmail(this.getFirebaseAuth(), email, {
      url: `${window.location.origin}/login`,
    });
  }

  private initializeAuthListenerSafely(): void {
    try {
      const auth = this.getFirebaseAuth();

      onIdTokenChanged(auth, (user) => {
        void this.handleAuthStateChanged(user);
      });
    } catch (error) {
      const message = this.mapAuthError(error);

      this.stateSignal.set({
        status: 'error',
        user: null,
        session: null,
        error: message,
      });

      this.resolveAuthReady();
    }
  }

  private getFirebaseAuth(): Auth {
    if (this.firebaseAuth) {
      return this.firebaseAuth;
    }

    const app = getApps().length ? getApp() : initializeApp(environment.firebase);
    const auth = getAuth(app);

    if (environment.useAuthEmulator && !this.emulatorConfigured) {
      try {
        connectAuthEmulator(auth, environment.authEmulatorUrl, {
          disableWarnings: true,
        });
      } catch (error) {
        const code =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          typeof error.code === 'string'
            ? error.code
            : '';

        const message =
          error instanceof Error
            ? error.message
            : '';

        const isAlreadyConfigured =
          code === 'auth/emulator-config-failed' ||
          message.includes('emulator') ||
          message.includes('already');

        if (!isAlreadyConfigured) {
          throw error;
        }
      }

      this.emulatorConfigured = true;
    }

    this.firebaseAuth = auth;

    return auth;
  }

  private async handleAuthStateChanged(user: User | null): Promise<void> {
    try {
      if (!user) {
        this.stateSignal.set({
          status: 'anonymous',
          user: null,
          session: null,
          error: null,
        });

        return;
      }

      const session = await this.fetchSession(user, false);

      this.stateSignal.set({
        status: 'authenticated',
        user,
        session,
        error: null,
      });
    } catch (error) {
      const message = this.mapAuthError(error);

      this.stateSignal.set({
        status: 'error',
        user: null,
        session: null,
        error: message,
      });
    } finally {
      this.resolveAuthReady();
    }
  }

  private async fetchSession(
    user: User,
    forceRefresh: boolean,
  ): Promise<AuthSession> {
    const idToken = await user.getIdToken(forceRefresh);

    const response = await firstValueFrom(
      this.http.get<ApiResponse<AuthSession>>(
        `${environment.apiBaseUrl}/auth/session-check`,
        {
          headers: new HttpHeaders({
            Authorization: `Bearer ${idToken}`,
          }),
        },
      ),
    );

    if (!response.ok) {
      throw new Error(response.error.message);
    }

    return response.data;
  }

  private async signOutSilently(): Promise<void> {
    try {
      const auth = this.getFirebaseAuth();

      await signOut(auth);
    } catch {
      // No interrumpe el flujo de cierre de sesión.
    }
  }

  private resolveAuthReady(): void {
    this.authReadyResolver?.();
    this.authReadyResolver = null;
  }

  private mapAuthError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return (
        error.error?.error?.message ??
        'No se pudo validar la sesión con el backend.'
      );
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
    ) {
      switch (error.code) {
        case 'auth/invalid-api-key':
          return 'La apiKey de Firebase en environment.development.ts no es válida.';
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          return 'Correo o contraseña incorrectos.';
        case 'auth/too-many-requests':
          return 'Demasiados intentos. Espere un momento y vuelva a intentar.';
        case 'auth/network-request-failed':
          return 'No hay conexión con Firebase Auth.';
        case 'auth/emulator-config-failed':
          return 'Firebase Auth Emulator ya fue configurado o se configuró demasiado tarde.';
        default:
          return `No se pudo iniciar sesión. Código: ${error.code}`;
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'No se pudo iniciar sesión.';
  }
}
