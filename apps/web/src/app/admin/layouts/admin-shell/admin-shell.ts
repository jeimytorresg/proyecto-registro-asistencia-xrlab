import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  CalendarRange,
  ClipboardList,
  Ellipsis,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MonitorSmartphone,
  PenLine,
  QrCode,
  ScrollText,
  UserCog,
  X,
  type LucideIconData,
} from 'lucide-angular';
import { filter } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { fmt } from '../../../shared/format';
import { Icon, Rings } from '../../../shared/ui';

interface NavItem {
  path: string;
  label: string;
  icon: LucideIconData;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { path: '/admin/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { path: '/admin/attendance', label: 'Registros', icon: ClipboardList },
  { path: '/admin/students', label: 'Estudiantes', icon: GraduationCap },
  { path: '/admin/manual-records', label: 'Registro manual', icon: PenLine },
  { path: '/admin/audit', label: 'Auditoría', icon: ScrollText },
  { path: '/admin/teachers', label: 'Docentes', icon: UserCog, adminOnly: true },
  { path: '/admin/periods', label: 'Periodos', icon: CalendarRange, adminOnly: true },
  { path: '/admin/kiosks', label: 'Kioskos', icon: MonitorSmartphone, adminOnly: true },
];

/** En móvil la barra inferior muestra solo estos accesos; el resto va en "Más". */
const QUICK_PATHS = ['/admin/dashboard', '/admin/attendance', '/admin/students'];

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Rings, A11yModule],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShell {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly icons = { qr: QrCode, logout: LogOut, more: Ellipsis, close: X };
  readonly moreOpen = signal(false);

  readonly name = computed(() => {
    const profile = this.auth.session()?.profile;
    return profile ? `${profile.firstName} ${profile.lastName}`.trim() : '';
  });
  readonly roleLabel = computed(() => fmt.role(this.auth.role()));

  readonly items = computed(() => NAV.filter((item) => !item.adminOnly || this.auth.role() === 'ADMIN'));
  readonly quickItems = computed(() => this.items().filter((item) => QUICK_PATHS.includes(item.path)));
  readonly moreItems = computed(() => this.items().filter((item) => !QUICK_PATHS.includes(item.path)));

  constructor() {
    // Al navegar, la hoja "Más" se cierra.
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.moreOpen.set(false));
  }

  logout(): void {
    void this.auth.logout();
  }
}
