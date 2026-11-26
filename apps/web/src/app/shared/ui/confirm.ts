import { Dialog, DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Texto del botón que confirma: el mismo verbo de la acción ("Desactivar"). */
  confirmLabel: string;
  cancelLabel?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  template: `
    <h2 id="confirm-title">{{ data.title }}</h2>
    <p id="confirm-message">{{ data.message }}</p>
    <div class="actions">
      <button class="btn secondary" type="button" (click)="ref.close(false)">
        {{ data.cancelLabel ?? 'Cancelar' }}
      </button>
      <button class="btn danger" type="button" (click)="ref.close(true)">{{ data.confirmLabel }}</button>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: min(92vw, 28rem);
      padding: var(--s-5);
      border-radius: var(--r-sheet);
      background: var(--surface);
      box-shadow: var(--shadow-float);
      animation: confirm-in var(--dur-base) var(--ease-out);
    }

    h2 {
      margin: 0 0 var(--s-2);
      font-size: var(--fs-title);
    }

    p {
      margin: 0 0 var(--s-5);
      color: var(--ink-2);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--s-3);
      margin: 0;
    }

    @keyframes confirm-in {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.98);
      }

      to {
        opacity: 1;
        transform: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  readonly ref = inject<DialogRef<boolean>>(DialogRef);
  readonly data = inject<ConfirmOptions>(DIALOG_DATA);
}

/**
 * Pide confirmación antes de una acción que no se deshace sola (desactivar, cerrar).
 * Devuelve true solo si la persona confirma; Esc, clic fuera o "Cancelar" devuelven false.
 * El foco cae primero en "Cancelar", la opción segura.
 */
@Injectable({ providedIn: 'root' })
export class Confirm {
  private readonly dialog = inject(Dialog);

  async ask(options: ConfirmOptions): Promise<boolean> {
    const ref = this.dialog.open<boolean, ConfirmOptions>(ConfirmDialog, {
      data: options,
      role: 'alertdialog',
      ariaLabelledBy: 'confirm-title',
      ariaDescribedBy: 'confirm-message',
      backdropClass: 'xr-backdrop',
      autoFocus: 'first-tabbable',
    });

    return (await firstValueFrom(ref.closed)) === true;
  }
}
