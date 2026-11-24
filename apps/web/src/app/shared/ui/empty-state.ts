import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Inbox, type LucideIconData } from 'lucide-angular';
import { Icon } from './icon';

/** Estado vacío: dice qué falta y ofrece la acción (contenido proyectado) para resolverlo. */
@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  template: `
    <div class="empty-state">
      <app-icon [icon]="icon()" [size]="28" />
      <h3>{{ title() }}</h3>
      @if (description(); as d) {
        <p>{{ d }}</p>
      }
      <div class="actions"><ng-content /></div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly description = input<string>();
  readonly icon = input<LucideIconData>(Inbox);
}
