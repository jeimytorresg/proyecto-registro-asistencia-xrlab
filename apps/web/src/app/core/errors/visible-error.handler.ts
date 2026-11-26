import { ErrorHandler, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Cuando algo falla de forma inesperada, la persona ve un aviso claro con una salida
 * ("Recargar"). El detalle técnico solo aparece en desarrollo.
 */
@Injectable()
export class VisibleErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error('XRLAB runtime error', error);

    document.querySelector('[data-xrlab-runtime-error]')?.remove();

    const container = document.createElement('section');
    container.setAttribute('data-xrlab-runtime-error', 'true');
    container.setAttribute('role', 'alertdialog');
    container.setAttribute('aria-labelledby', 'xrlab-error-title');
    container.style.cssText = [
      'position: fixed',
      'inset: 0',
      'z-index: 99999',
      'display: grid',
      'place-items: center',
      'padding: 1rem',
      'overflow: auto',
      'background: rgb(10 37 64 / 0.6)',
      'font-family: var(--font, system-ui, sans-serif)',
    ].join(';');

    const panel = document.createElement('div');
    panel.style.cssText = [
      'width: min(100%, 32rem)',
      'padding: 1.5rem',
      'border-radius: 20px',
      'background: #fff',
      'color: #0a2540',
      'box-shadow: 0 8px 28px rgb(10 37 64 / 0.3)',
    ].join(';');

    const title = document.createElement('h1');
    title.id = 'xrlab-error-title';
    title.textContent = 'Algo salió mal';
    title.style.cssText = 'margin: 0 0 0.5rem; font-size: 1.5rem; line-height: 1.2;';

    const text = document.createElement('p');
    text.textContent = 'Recarga la página para continuar. Si el problema sigue, avisa a un administrador.';
    text.style.cssText = 'margin: 0 0 1.25rem; color: #3b4d5e; font-size: 1.0625rem;';

    const reload = document.createElement('button');
    reload.type = 'button';
    reload.textContent = 'Recargar página';
    reload.style.cssText = [
      'min-height: 44px',
      'padding: 0 1.25rem',
      'border: 0',
      'border-radius: 8px',
      'background: #febe10',
      'color: #0a2540',
      'font: inherit',
      'font-weight: 650',
      'cursor: pointer',
    ].join(';');
    reload.addEventListener('click', () => window.location.reload());

    panel.append(title, text, reload);

    if (!environment.production) {
      const detail = document.createElement('pre');
      detail.textContent =
        error instanceof Error ? `${error.name}: ${error.message}\n\n${error.stack ?? ''}` : String(error);
      detail.style.cssText = [
        'margin: 1.25rem 0 0',
        'max-height: 40vh',
        'overflow: auto',
        'padding: 1rem',
        'border-radius: 12px',
        'background: #0a2540',
        'color: #e3edf5',
        'font-size: 0.8125rem',
        'line-height: 1.5',
        'white-space: pre-wrap',
      ].join(';');
      panel.append(detail);
    }

    container.append(panel);
    document.body.appendChild(container);
    reload.focus();
  }
}
