import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideAngularModule, type LucideIconData } from 'lucide-angular';

/** Ícono decorativo (aria-hidden). Para un ícono con significado, acompáñalo siempre de texto. */
@Component({
  selector: 'app-icon',
  imports: [LucideAngularModule],
  template: `<lucide-angular [img]="icon()" [size]="size()" [strokeWidth]="1.75" aria-hidden="true" />`,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }

    /* El elemento de lucide es inline por defecto y su svg se apoya en la línea base: se centra con flex. */
    lucide-angular {
      display: flex;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  readonly icon = input.required<LucideIconData>();
  readonly size = input(18);
}
