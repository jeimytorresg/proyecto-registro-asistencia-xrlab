import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-admin-home',
  template: `
    <section class="placeholder-layout">
      <article class="card hero-card">
        <p class="eyebrow">Panel administrativo</p>
        <h1>Dashboard y gestión XRLAB</h1>
        <p class="lead">
          En PC3 se mostrarán registros filtrados. En PC4 se agregará gestión de estudiantes,
          docentes, periodos, registros manuales, auditoría y exportación.
        </p>
      </article>

      <article class="card">
        <h2>Módulos previstos</h2>
        <ul class="status-list">
          <li>Dashboard operativo.</li>
          <li>Registros con filtros y paginación.</li>
          <li>Gestión académica.</li>
          <li>Auditoría y reportes.</li>
        </ul>
      </article>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminHome {}