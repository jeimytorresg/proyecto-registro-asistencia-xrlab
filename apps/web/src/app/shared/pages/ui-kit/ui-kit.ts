import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Alert, Badge, EmptyState } from '../../ui';

/** Muestrario de componentes base. Solo existe en desarrollo (ruta /ui-kit). */
@Component({
  selector: 'app-ui-kit',
  imports: [Alert, Badge, EmptyState],
  template: `
    <div class="stack" style="gap: 2rem">
      <header>
        <h1>Componentes base</h1>
        <p class="muted">Muestrario del sistema de diseño. No se publica en producción.</p>
      </header>

      <section class="stack">
        <h2>Tipografía</h2>
        <div class="panel stack" style="gap: 0.5rem">
          <div style="font-size: var(--fs-display); font-weight: 650; line-height: 1.1">Registro del laboratorio</div>
          <h1 style="margin: 0">Quién está dentro ahora</h1>
          <h2 style="margin: 0">Últimos registros</h2>
          <p style="margin: 0; max-width: 62ch">
            El texto de cuerpo usa 16 px con interlínea de 1,55 y líneas de máximo 70 caracteres.
            Ñandú, camión, pingüino, atención, sesión, año.
          </p>
          <small>Texto de ayuda · 13 px</small>
          <div style="font-size: var(--fs-title)">08:05 &nbsp; 1 234,5 h &nbsp; 0123456789 (proporcional)</div>
        </div>
      </section>

      <section class="stack">
        <h2>Botones</h2>
        <div class="panel row">
          <button class="btn" type="button">Registrar entrada</button>
          <button class="btn secondary" type="button">Ver detalle</button>
          <button class="btn ghost" type="button">Cancelar</button>
          <button class="btn danger" type="button">Cerrar sesión de kiosko</button>
          <button class="btn" type="button" disabled>Deshabilitado</button>
          <button class="btn" type="button" aria-busy="true" disabled>Registrando salida…</button>
          <button class="btn sm secondary" type="button">Pequeño</button>
        </div>
      </section>

      <section class="stack">
        <h2>Campos</h2>
        <form class="panel form-two" (submit)="$event.preventDefault()">
          <div class="field">
            <label for="k-email">Correo institucional</label>
            <input id="k-email" type="email" placeholder="nombre@utpl.edu.ec" />
            <span class="hint">Usa el correo con el que te registraron.</span>
          </div>
          <div class="field">
            <label for="k-pass">Contraseña</label>
            <input id="k-pass" type="text" aria-invalid="true" aria-describedby="k-pass-err" value="x" />
            <span class="error" id="k-pass-err">La contraseña no coincide. Inténtalo de nuevo.</span>
          </div>
          <div class="field">
            <label for="k-sel">Periodo</label>
            <select id="k-sel"><option>2026-2</option><option>2026-1</option></select>
          </div>
          <div class="field">
            <label for="k-dis">Campo deshabilitado</label>
            <input id="k-dis" disabled value="No editable" />
          </div>
          <div class="field" style="grid-column: 1 / -1">
            <label for="k-txt">Actividades realizadas</label>
            <textarea id="k-txt" rows="3"></textarea>
            <span class="hint">Una actividad por línea.</span>
          </div>
        </form>
      </section>

      <section class="stack">
        <h2>Estados</h2>
        <div class="panel row">
          <app-badge kind="live">Dentro</app-badge>
          <app-badge kind="ok">Completa</app-badge>
          <app-badge kind="warn">Incompleta</app-badge>
          <app-badge kind="err">Rechazada</app-badge>
          <app-badge kind="neutral">Manual</app-badge>
        </div>
        <app-alert kind="ok" title="Entrada registrada">Quedó anotada a las 08:05.</app-alert>
        <app-alert kind="warn" title="Tienes una entrada abierta">Registra tus actividades para confirmar la salida.</app-alert>
        <app-alert kind="err" title="El QR venció">Escanea el que aparece ahora en la pantalla del kiosko.</app-alert>
        <app-alert kind="info">Los datos se actualizan cada minuto.</app-alert>
      </section>

      <section class="stack">
        <h2>Tabla</h2>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>Estudiante</th><th>Entrada</th><th>Salida</th><th>Duración</th><th>Estado</th></tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="Estudiante">Ana Vélez<small>ana.velez&#64;utpl.edu.ec</small></td>
                <td class="num" data-label="Entrada">08:05</td>
                <td class="num" data-label="Salida">—</td>
                <td class="num" data-label="Duración">2 h 15 min</td>
                <td data-label="Estado"><app-badge kind="live">Dentro</app-badge></td>
              </tr>
              <tr>
                <td data-label="Estudiante">Luis Mora<small>luis.mora&#64;utpl.edu.ec</small></td>
                <td class="num" data-label="Entrada">07:40</td>
                <td class="num" data-label="Salida">09:55</td>
                <td class="num" data-label="Duración">2 h 15 min</td>
                <td data-label="Estado"><app-badge kind="ok">Completa</app-badge></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="stack">
        <h2>Vacío y carga</h2>
        <div class="panel">
          <app-empty-state
            title="Todavía no hay registros hoy"
            description="Cuando un estudiante escanee el QR, aparecerá aquí."
          >
            <button class="btn secondary" type="button">Abrir kiosko</button>
          </app-empty-state>
        </div>
        <div class="panel stack" style="gap: 0.75rem" aria-hidden="true">
          <span class="skeleton" style="width: 40%; height: 1.25rem"></span>
          <span class="skeleton" style="width: 90%"></span>
          <span class="skeleton" style="width: 70%"></span>
        </div>
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiKit {}
