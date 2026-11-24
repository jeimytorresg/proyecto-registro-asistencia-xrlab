import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RefreshCw } from 'lucide-angular';
import type { DashboardSummary } from '../../../core/models/admin.models';
import { AdminService } from '../../../core/services/admin.service';
import { fmt } from '../../../shared/format';
import { Alert, Badge, EmptyState, Icon } from '../../../shared/ui';

@Component({
  selector: 'app-admin-dashboard',
  imports: [Alert, Badge, EmptyState, Icon],
  templateUrl: './admin-dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboard implements OnInit {
  private readonly adminService = inject(AdminService);

  readonly fmt = fmt;
  readonly refreshIcon = RefreshCw;
  readonly dashboard = signal<DashboardSummary | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      this.dashboard.set(await this.adminService.getDashboard());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
