import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

function renderBootstrapError(error: unknown): void {
  console.error('XRLAB bootstrap error', error);

  const root = document.querySelector('app-root');
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}${environment.production ? '' : `\n\n${error.stack ?? ''}`}`
      : String(error);

  const wrapper = document.createElement('main');
  wrapper.style.minHeight = '100vh';
  wrapper.style.display = 'grid';
  wrapper.style.placeItems = 'center';
  wrapper.style.padding = '2rem';
  wrapper.style.background = '#f4f7f9';
  wrapper.style.fontFamily = 'Arial, Helvetica, sans-serif';

  wrapper.innerHTML = `
    <section style="
      max-width: 960px;
      width: 100%;
      background: #fff;
      border: 1px solid #fecdca;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.14);
    ">
      <p style="
        margin: 0 0 8px;
        color: #b42318;
        font-weight: 800;
        letter-spacing: .08em;
        text-transform: uppercase;
      ">
        Error de arranque Angular
      </p>
      <h1 style="margin: 0 0 12px; color: #004270;">
        XRLAB no pudo iniciar
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
    </section>
  `;

  const pre = wrapper.querySelector('pre');

  if (pre) {
    pre.textContent = message;
  }

  if (root) {
    root.replaceChildren(wrapper);
  } else {
    document.body.appendChild(wrapper);
  }
}

bootstrapApplication(App, appConfig).catch(renderBootstrapError);
