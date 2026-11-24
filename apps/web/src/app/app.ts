import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from './core/services/auth.service';
import { fmt } from './shared/format';

/** Rutas que traen su propio diseño a pantalla completa (sin cabecera global). */
function isFullBleed(url: string): boolean {
  return url === '/' || url.startsWith('/login') || url.startsWith('/admin');
}

/** Rutas con cabecera mínima pero contenido de borde a borde. */
function isEdgeToEdge(url: string): boolean {
  return url.startsWith('/student');
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: location.pathname },
  );

  readonly fullBleed = computed(() => isFullBleed(this.url()));
  readonly edgeToEdge = computed(() => this.fullBleed() || isEdgeToEdge(this.url()));

  readonly name = computed(() => {
    const profile = this.auth.session()?.profile;
    return profile ? `${profile.firstName} ${profile.lastName}`.trim() : '';
  });
  readonly roleLabel = computed(() => fmt.role(this.auth.role()));
  readonly canManage = computed(() => this.auth.role() === 'ADMIN' || this.auth.role() === 'TEACHER');

  logout(): void {
    void this.auth.logout();
  }
}
