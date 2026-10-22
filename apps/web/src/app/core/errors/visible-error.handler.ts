import { ErrorHandler, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable()
export class VisibleErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error('XRLAB runtime error', error);

    const message =
      error instanceof Error
        ? `${error.name}: ${error.message}${environment.production ? '' : `\n\n${error.stack ?? ''}`}`
        : String(error);

    const existing = document.querySelector('[data-xrlab-runtime-error]');

    if (existing) {
      existing.remove();
    }

    const container = document.createElement('section');
    container.setAttribute('data-xrlab-runtime-error', 'true');
    container.style.position = 'fixed';
    container.style.inset = '1rem';
    container.style.zIndex = '99999';
    container.style.overflow = 'auto';
    container.style.background = '#fff';
    container.style.border = '1px solid #fecdca';
    container.style.borderRadius = '16px';
    container.style.padding = '20px';
    container.style.boxShadow = '0 18px 42px rgba(15, 23, 42, 0.2)';
    container.style.fontFamily = 'Arial, Helvetica, sans-serif';

    container.innerHTML = `
      <p style="
        margin: 0 0 8px;
        color: #b42318;
        font-weight: 800;
        letter-spacing: .08em;
        text-transform: uppercase;
      ">
        Error runtime Angular
      </p>
      <h1 style="margin: 0 0 12px; color: #004270;">
        XRLAB detectó un error en frontend
      </h1>
      <p style="color: #64748b;">
        Copia este error completo para corregir la causa exacta.
      </p>
      <pre style="
        overflow: auto;
        white-space: pre-wrap;
        background: #111827;
        color: #f9fafb;
        padding: 16px;
        border-radius: 12px;
        line-height: 1.5;
      "></pre>
    `;

    const pre = container.querySelector('pre');

    if (pre) {
      pre.textContent = message;
    }

    document.body.appendChild(container);
  }
}
