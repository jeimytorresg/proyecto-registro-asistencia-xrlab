import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-angular';
import { Icon } from './icon';

export type AlertKind = 'info' | 'ok' | 'warn' | 'err';

const ICONS = { info: Info, ok: CircleCheck, warn: TriangleAlert, err: CircleAlert } as const;

/** Mensaje en línea: qué pasó y qué hacer. Los errores usan role="alert". */
@Component({
  selector: 'app-alert',
  imports: [Icon],
  template: `
    <div class="alert" [class]="kind()" [attr.role]="kind() === 'err' ? 'alert' : 'status'">
      <app-icon [icon]="icon()" />
      <div>
        @if (title(); as t) {
          <span class="alert-title">{{ t }}</span>
        }
        <span class="alert-body"><ng-content /></span>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Alert {
  readonly kind = input<AlertKind>('info');
  readonly title = input<string>();
  readonly icon = computed(() => ICONS[this.kind()]);
}
