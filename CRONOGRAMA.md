# Cronograma XRLAB – 3 meses (13 semanas)

**Periodo:** lunes 19 de octubre de 2026 → viernes 15 de enero de 2027
**Equipo:** 2 seniors (S1, S2) + 2 juniors (J1, J2)
**Ritmo:** sprints de 2 semanas (el último de 3), con demo y retrospectiva el viernes de cierre de cada sprint.

## 1. Punto de partida

Ya está construido (PC1–PC4): login con Firebase Auth + roles (ADMIN / TEACHER / STUDENT), kiosco con QR rotativo, registro de asistencia, panel admin (estudiantes, docentes, periodos, kioscos, registros manuales, auditoría) y backend en Cloud Functions + PostgreSQL (Neon).

Tablas actuales: `users_profiles`, `careers`, `practice_types`, `teachers`, `students`, `academic_periods`, `teacher_student_assignments`, `kiosks`, `kiosk_sessions`, `attendance_sessions`, `activities`, `qr_token_usages`, `audit_logs`.
**No existe aún el concepto de materias ni de matrículas**, por lo que hay que modelarlo.

## 2. Requisitos nuevos

| ID | Requisito |
|----|-----------|
| R1 | Nombre del sistema: preferentemente **"Bienvenido al registro de estudiantes"**. |
| R2 | El sistema también sirve para **préstamo de equipos del laboratorio** (tipo inventario). |
| R3 | El QR debe poder leerse con el **lector de QR nativo del teléfono** y **redirigir a la página principal**. |
| R4 | **Importación masiva de estudiantes, docentes y materias** desde CSV, JSON o Excel. |
| R5 | **Rediseño completo** de la página (todas las pantallas). |

## 3. Roles del equipo

| Sigla | Perfil | Foco principal |
|-------|--------|----------------|
| **S1** | Senior backend | Arquitectura, API, base de datos, importaciones, seguridad, despliegue |
| **S2** | Senior frontend/UX | Sistema de diseño, arquitectura Angular, UX, PWA, revisión de código |
| **J1** | Junior backend | Endpoints, migraciones, seeds, parsers, scripts de verificación (en pareja con S1) |
| **J2** | Junior frontend | Pantallas, formularios, componentes, pruebas unitarias (en pareja con S2) |

Los seniors revisan todo PR de los juniors.

**Dos carriles en paralelo:**
- **Carril backend (S1 + J1):** QR móvil → importaciones → modelo de materias e inventario → préstamos → reportes.
- **Carril frontend (S2 + J2):** sistema de diseño → rediseño de pantallas → pantallas de importación e inventario → dashboard.

## 4. Resumen por fases

| Fase | Semanas | Fechas | Backend (S1 + J1) | Frontend (S2 + J2) |
|------|---------|--------|-------------------|--------------------|
| 0 | 1 | 19 – 23 oct | Entorno y estabilización | Auditoría UI y lineamientos |
| 1 | 2 – 3 | 26 oct – 6 nov | QR con lector del teléfono (R3) | Sistema de diseño + marca "Bienvenido" (R1, R5) |
| 2 | 4 – 5 | 9 – 20 nov | Motor de importación + estudiantes (R4) | Rediseño login, estudiante y kiosco (R5) |
| 3 | 6 – 7 | 23 nov – 4 dic | Importar docentes y materias; modelo de materias; modelo de inventario (R4, R2) | Rediseño del panel admin + pantallas de importación (R5, R4) |
| 4 | 8 – 10 | 7 – 24 dic | API de equipos, préstamos y reportes (R2) | UI de inventario, préstamos y dashboard (R2, R5) |
| 5 | 11 – 13 | 28 dic – 15 ene | QA, seguridad, despliegue | QA, UAT, pulido visual, capacitación |

> Feriados en Ecuador a considerar (verificar calendario oficial): 2–3 nov, 25 dic y 1 ene. Las semanas 3, 10, 11 y 12 tienen holgura para absorberlos.

---

## 5. Detalle por semana

### Fase 0 – Estabilización y entorno

**Semana 1 (19 – 23 oct)**

| Responsable | Tareas | Entregable |
|-------------|--------|-----------|
| S1 | Decidir si el desarrollo usa Neon o PostgreSQL local (hay redes que bloquean el puerto 5432); documentar y automatizar | Guía de arranque + script de emuladores |
| S1 | Rotar la credencial de Neon expuesta en `functions/.env.example` y dejar placeholder | `.env.example` limpio, secretos fuera del repo |
| S2 | Auditar el frontend actual; levantar inventario de pantallas y flujos a rediseñar | Inventario de pantallas + referencias visuales |
| J1 | Configurar entorno, correr migraciones/seeds y los scripts `pc1`–`pc4:verify` | Entorno funcionando + reporte |
| J2 | Configurar entorno y documentar componentes y estilos existentes | Catálogo de componentes actuales |
| Todos | Refinar backlog y acordar alcance de R1–R5 con el cliente (formato de archivos de importación, estilo visual) | Backlog priorizado, plantillas de importación de ejemplo |

**Hito H0 (23 oct):** todo el equipo corre el sistema localmente y el alcance está firmado.

### Fase 1 – Sistema de diseño y QR móvil

**Semana 2 (26 – 30 oct)**

| Responsable | Tareas | Entregable |
|-------------|--------|-----------|
| S2 | Definir identidad visual: paleta, tipografía, espaciado, iconografía, modo claro/oscuro; diseñar la pantalla de bienvenida | Guía de estilo + prototipos de alta fidelidad (login, home) |
| J2 | Implementar tokens de diseño (variables SCSS) y componentes base: botón, input, card, alerta | Primera versión del sistema de diseño |
| S1 | Diseñar el QR como **URL (deep link)** firmada, p. ej. `https://<dominio>/q?t=<token>` | Documento de diseño técnico |
| J1 | Endpoint `GET /api/qr/resolve` que valida el token y devuelve el destino | Endpoint con pruebas |

**Semana 3 (2 – 6 nov)** *(feriados 2–3 nov)*

| Responsable | Tareas | Entregable |
|-------------|--------|-----------|
| S2 | Ruta `/q` en Angular: lee el token, redirige a login si no hay sesión y regresa después | Flujo de redirección |
| J2 | Aplicar nombre **"Bienvenido al registro de estudiantes"** en login, cabecera, `index.html`, manifest PWA y títulos; ampliar componentes (tabla, modal, badge, tabs) | R1 implementado + biblioteca de componentes v2 |
| S1 | Mantener compatibilidad con el escáner interno; ajustar rotación/expiración del token | Backend compatible con ambos lectores |
| J1 | Pruebas de integración y script `pc5:verify` del flujo QR | Script de verificación |
| Todos | Pruebas del QR en iOS y Android con la cámara nativa | Matriz de pruebas |

**Hito H1 (6 nov) – Demo 1:** el QR se escanea con la cámara del teléfono y abre la página principal. Sistema de diseño aprobado. R1 y R3 cerrados.

### Fase 2 – Importación (base) y rediseño de pantallas públicas

**Semana 4 (9 – 13 nov)**

| Responsable | Tareas | Entregable |
|-------------|--------|-----------|
| S1 | Diseñar el **motor de importación genérico**: subida de archivo, parser por formato (CSV, JSON, XLSX con `exceljs`), mapeo de columnas, validación con zod, modo "vista previa" (dry-run) y reporte de errores por fila | Diseño + esqueleto del motor |
| J1 | Parsers CSV y JSON, normalización (tildes, mayúsculas, espacios, codificación UTF-8/BOM) y pruebas con archivos reales | Parsers con tests |
| S2 | Rediseñar login y pantalla de bienvenida, y la vista del estudiante (`/student`) | Pantallas rediseñadas |
| J2 | Maquetar pantallas en móvil primero (responsive) y aplicar los componentes nuevos | Login y estudiante implementados |

**Semana 5 (16 – 20 nov)**

| Responsable | Tareas | Entregable |
|-------------|--------|-----------|
| S1 | **Importación de estudiantes**: creación de usuario en Firebase Auth + perfil + estudiante en PostgreSQL, en transacción por lote; manejo de duplicados (cédula/correo) con política configurable (omitir / actualizar) | Endpoint `POST /api/admin/import/students` |
| J1 | Parser XLSX, endpoint de plantilla descargable (CSV/XLSX) y registro de cada importación en `audit_logs` | Plantillas + auditoría |
| S2 | Rediseñar el kiosco (`/kiosk`) pensando en pantalla grande y QR legible a distancia | Kiosco rediseñado |
| J2 | Implementar kiosco y estados de error/carga/vacío en todas las pantallas nuevas | Kiosco implementado |

**Hito H2 (20 nov) – Demo 2:** login, estudiante y kiosco con el nuevo diseño; importación de estudiantes por API con las tres formatos.

### Fase 3 – Importación (docentes y materias) y rediseño del admin

**Semana 6 (23 – 27 nov)**

| Responsable | Tareas | Entregable |
|-------------|--------|-----------|
| S1 | Modelar **materias y matrículas**: `subjects`, `subject_offerings` (materia por periodo y docente), `enrollments` (estudiante ↔ materia) | Migración `0004_subjects.sql` + diagrama ER |
| J1 | **Importación de docentes** (Auth + perfil + rol TEACHER) reutilizando el motor | `POST /api/admin/import/teachers` |
| S2 | Rediseñar el shell del admin (menú lateral, cabecera, navegación móvil) y dashboard | Layout admin nuevo |
| J2 | Rediseñar listados de estudiantes y docentes (tabla, filtros, paginación) | Listados rediseñados |

**Semana 7 (30 nov – 4 dic)**

| Responsable | Tareas | Entregable |
|-------------|--------|-----------|
| S1 | **Importación de materias** (con docente, periodo y, opcionalmente, estudiantes matriculados) y CRUD de materias | `POST /api/admin/import/subjects` + API de materias |
| J1 | Modelo de inventario: `equipment_categories`, `equipment`, `equipment_units`, `loans`, `loan_items`, `loan_events` | Migración `0005_inventory.sql` |
| S2 | **Pantalla de importación** (asistente en 4 pasos: elegir tipo → subir archivo → vista previa con errores → confirmar) | Asistente de importación |
| J2 | Pantallas de materias, periodos, kioscos, registros manuales y auditoría con el nuevo diseño | Resto del admin rediseñado |

**Hito H3 (4 dic) – Demo 3:** importación de estudiantes, docentes y materias desde la interfaz; panel admin completamente rediseñado. R4 cerrado.

### Fase 4 – Inventario, préstamos y reportes

**Semana 8 (7 – 11 dic)**

| Responsable | Tareas | Entregable |
|-------------|--------|-----------|
| S1 | API de categorías y equipos (solo ADMIN/TEACHER escriben); estados `DISPONIBLE`, `PRESTADO`, `MANTENIMIENTO`, `BAJA` | API de catálogo |
| J1 | Seeds de equipos, validaciones, búsqueda y paginación; generación de **etiqueta QR imprimible por equipo** | Etiquetas PDF/PNG |
| S2 | Diseñar flujo de inventario y préstamo (escanear equipo → elegir estudiante → confirmar) | Prototipos |
| J2 | Pantalla de catálogo de equipos: listado, alta, edición, detalle | Catálogo de inventario |

**Semana 9 (14 – 18 dic)**

| Responsable | Tareas | Entregable |
|-------------|--------|-----------|
| S1 | Reglas de préstamo: un equipo = un préstamo activo, plazos, devolución con estado (bueno/dañado), bloqueo por préstamos vencidos, auditoría | Servicio de préstamos |
| J1 | Endpoints `POST /loans`, `POST /loans/:id/return`, `GET /loans`, historiales | API de préstamos |
| S2 | Flujo de préstamo y devolución con escaneo de QR | Flujo completo |
| J2 | Vista del estudiante **"Mis préstamos"** y lista de préstamos activos | Vistas de préstamos |

**Semana 10 (21 – 24 dic)** *(semana corta por fiestas)*

| Responsable | Tareas | Entregable |
|-------------|--------|-----------|
| S1 | Reportes: equipos más prestados, préstamos vencidos, asistencia por materia; exportación a Excel | API de reportes |
| J1 | Alertas de préstamos vencidos y pruebas de carga básicas | Alertas + informe |
| S2 | Dashboard unificado (asistencia + inventario + importaciones recientes) | Dashboard |
| J2 | Gráficos y tarjetas de resumen | Widgets |

**Hito H4 (24 dic) – Demo 4 y feature freeze:** todas las funcionalidades terminadas.

### Fase 5 – Calidad, despliegue y cierre

**Semana 11 (28 dic – 1 ene)** *(1 ene feriado)*

| Responsable | Tareas | Entregable |
|-------------|--------|-----------|
| S1 | Revisión de seguridad: roles, validación de archivos subidos (tamaño, tipo, inyección en CSV/Excel), rate limiting, secretos, CORS | Informe de seguridad |
| S2 | Revisión de consistencia visual y accesibilidad (contraste, teclado, lectores de pantalla) | Informe de accesibilidad |
| J1 | Corrección de bugs backend y pruebas de importación con archivos grandes (miles de filas) | Bugs críticos = 0 |
| J2 | Corrección de bugs frontend y pruebas en distintos navegadores y dispositivos | Bugs críticos = 0 |

**Semana 12 (4 – 8 ene)**

| Responsable | Tareas | Entregable |
|-------------|--------|-----------|
| Todos | UAT con docentes, administradores y estudiantes reales | Acta de UAT |
| S1 | Preparar producción: proyecto Firebase, base de datos, variables, migraciones | Entorno de producción listo |
| S2 | Build de producción, PWA/caché y rendimiento (Lighthouse) | Build optimizado |
| J1 / J2 | Manual de usuario (incluye guía de plantillas de importación) y manual técnico | Manuales borrador |

**Semana 13 (11 – 15 ene)**

| Responsable | Tareas | Entregable |
|-------------|--------|-----------|
| S1 | Despliegue a producción, monitoreo y plan de respaldo | Sistema en producción |
| S2 | Smoke tests en producción y ajustes finales | Reporte de salida |
| J1 / J2 | Manuales finales y capacitación a usuarios | Manuales + capacitación |
| Todos | Retrospectiva final, entrega y acta de cierre | **Entrega final (15 ene)** |

---

## 6. Hitos y entregables clave

| Hito | Fecha | Entregable |
|------|-------|-----------|
| H0 | 23 oct | Entorno reproducible, alcance y plantillas de importación acordados |
| H1 | 6 nov | R1 + R3 + sistema de diseño aprobado |
| H2 | 20 nov | Pantallas públicas rediseñadas; importación de estudiantes (CSV/JSON/XLSX) |
| H3 | 4 dic | R4 completo (estudiantes, docentes, materias) y admin rediseñado |
| H4 | 24 dic | Inventario, préstamos, reportes y feature freeze |
| H5 | 8 ene | UAT aprobado |
| H6 | 15 ene | Producción, manuales y capacitación |

## 7. Formatos de importación (a confirmar en la Semana 1)

| Entidad | Columnas mínimas sugeridas |
|---------|----------------------------|
| Estudiantes | cédula, nombres, apellidos, correo institucional, carrera, periodo |
| Docentes | cédula, nombres, apellidos, correo institucional |
| Materias | código, nombre, carrera, periodo, correo del docente, (opcional) lista de estudiantes matriculados |

Reglas comunes: vista previa antes de confirmar, informe de filas con error descargable, política de duplicados (omitir o actualizar), límite de tamaño de archivo y registro en auditoría.

## 8. Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| **El alcance creció (rediseño total + importaciones + inventario) y el plazo sigue siendo 13 semanas** | Retrasos o baja calidad | Dos carriles en paralelo; el rediseño se hace sobre un sistema de diseño común; si hay atraso, inventario avanzado (reportes, alertas) pasa a una fase posterior |
| Archivos de importación con formatos inconsistentes (tildes, columnas, codificación) | Errores y datos sucios | Plantillas oficiales, vista previa con validación y reporte de errores por fila |
| Creación masiva de usuarios en Firebase Auth (límites y lentitud) | Importaciones lentas | Procesar por lotes y mostrar progreso; probar con volúmenes reales en la Semana 11 |
| Redes que bloquean el puerto 5432 de Neon | Backend no conecta | PostgreSQL local en desarrollo (Semana 1) |
| Cámaras de iOS/Android se comportan distinto con el QR | Retraso en R3 | Pruebas en dispositivos reales desde la Semana 3 |
| Cambios de diseño tardíos | Retrabajo en todas las pantallas | Aprobar el sistema de diseño en H1 y congelarlo |
| Feriados y fin de año | Menos capacidad | Holgura en semanas 10–12 |

## 9. Definición de terminado

- Código revisado por un senior y fusionado a la rama principal.
- Pruebas automatizadas y script `verify` del módulo en verde.
- Usa los componentes del sistema de diseño y funciona en móvil (iOS y Android) y en escritorio.
- Documentación actualizada.
- Demo aprobada por el cliente al cierre del sprint.
