import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CircleAlert, CircleCheck, CircleDot, Minus, TriangleAlert } from 'lucide-angular';
import { Icon } from './icon';

export type BadgeKind = 'live' | 'ok' | 'warn' | 'err' | 'neutral';

const ICONS = {
  live: CircleDot,
  ok: CircleCheck,
  warn: TriangleAlert,
  err: CircleAlert,
  neutral: Minus,
} as const;

/** Estado con ícono y texto (nunca solo color). `live` = dentro del laboratorio. */
@Component({
  selector: 'app-badge',
  imports: [Icon],
  template: `<span class="badge" [class]="kind()"><app-icon [icon]="icon()" [size]="14" /><ng-content /></span>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Badge {
  readonly kind = input<BadgeKind>('neutral');
  readonly icon = computed(() => ICONS[this.kind()]);
}
