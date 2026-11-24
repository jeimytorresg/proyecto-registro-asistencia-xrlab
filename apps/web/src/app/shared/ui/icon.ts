import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideAngularModule, type LucideIconData } from 'lucide-angular';

/** Ícono decorativo (aria-hidden). Para un ícono con significado, acompáñalo siempre de texto. */
@Component({
  selector: 'app-icon',
  imports: [LucideAngularModule],
  template: `<lucide-angular [img]="icon()" [size]="size()" [strokeWidth]="1.75" aria-hidden="true" />`,
  host: { style: 'display: inline-flex; flex: none;' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  readonly icon = input.required<LucideIconData>();
  readonly size = input(18);
}
