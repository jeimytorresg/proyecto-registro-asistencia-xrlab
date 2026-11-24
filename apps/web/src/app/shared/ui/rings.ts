import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Motivo gráfico del sistema: anillos concéntricos, eco del QR rotatorio del kiosko.
 * Decorativo y estático. El padre lo posiciona (clase) y puede ajustar `--rings-opacity`.
 * Con `accent`, añade el arco amarillo ("lo vivo").
 */
@Component({
  selector: 'app-rings',
  template: `
    <svg viewBox="0 0 400 400" aria-hidden="true" focusable="false">
      <circle cx="200" cy="200" r="60" />
      <circle cx="200" cy="200" r="105" />
      <circle cx="200" cy="200" r="150" />
      <circle cx="200" cy="200" r="195" />
      @if (accent()) {
        <circle class="arc" cx="200" cy="200" r="150" pathLength="100" />
        <circle class="dot" cx="125" cy="330" r="7" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
      pointer-events: none;
    }

    svg {
      display: block;
      width: 100%;
      height: auto;
      fill: none;
      stroke: #fff;
      stroke-opacity: var(--rings-opacity, 0.14);
      stroke-width: 1.5;
    }

    .arc {
      stroke: var(--yellow-500);
      stroke-opacity: 1;
      stroke-width: 3;
      stroke-linecap: round;
      stroke-dasharray: 28 72;
      transform: rotate(120deg);
      transform-origin: 200px 200px;
    }

    .dot {
      fill: var(--yellow-500);
      stroke: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rings {
  readonly accent = input(false);
}
