# Migración de Firebase Functions a un backend NestJS

Estado: **Fases 0, 1 y 2 hechas y subidas** (rama `feat/migracion-nest`). Siguiente: Fase 3. Ver "Para retomar".

## Actualización 2026-11-24

- **Fase 2 hecha:** migración `database/migrations/0004_auth_propio.sql`, módulo `apps/api/src/auth`
  (login, refresh rotativo con detección de reutilización, logout, set-password, forgot-password, session-check),
  `JwtAuthGuard` con `@Auth(...roles)`, correo por la API HTTP de Resend, contraseñas con argon2id, zod 4.
  77 tests pasando. **Decisiones tomadas por defecto** (se pueden cambiar): proveedor de correo Resend y
  Fase 5 con la opción A (importar usuarios y que definan contraseña nueva).
- **Sin verificar todavía:** la migración `0004` y los repositorios SQL no se han ejecutado contra un Postgres
  real (Docker Desktop no estaba encendido). Es lo primero que hay que hacer: `npm run db:up`,
  `npm run database:migrate:all`, y probar login/set-password de punta a punta.
- **Fase 3 sin empezar** (kiosk, attendance, admin). Es la parte más grande: unas 3.000 líneas a portar.
- **Trabajo para juniors:** ver [`docs/juniors/README.md`](./juniors/README.md). Son tareas que solo agregan
  archivos nuevos (tests, README, Dockerfile, lógica pura del QR).
- Los scripts `pcN-verify` todavía hacen login contra el emulador de Firebase; falta el helper de login propio.
- Deuda de la Fase 2: tests e2e con JSON malformado y body de más de 300 kb, y revisión con `security-reviewer`
  del módulo de auth (pendiente).

## Para retomar (última actualización: 2026-11-21, anterior a la Fase 2)

**Dónde está el trabajo:** rama `feat/migracion-nest` en
`C:\Users\LENOVO\Desktop\Proyectos\colaboraciones\proyecto-registro-asistencia-xrlab`. **Nada está commiteado.**
`git status`: modificados `.gitignore` y `package.json`; sin seguir `apps/api/`, `docker-compose.yml` y `docs/`.
El `origin` es `jeimytorresg/proyecto-registro-asistencia-xrlab` (repo de otra persona): antes de hacer push,
comprobar que hay permisos de escritura o trabajar con fork + PR.

**Estado verificado:** en `apps/api`, `npx tsc --noEmit -p tsconfig.json` limpio y `npx jest` con 40/40 tests
(98 % de cobertura en sentencias). La API compilada arrancó y respondió `/api/health`, el 404 y el CORS.
La revisión de código (`code-reviewer`) dio veredicto aprobado.

**Pendiente inmediato, en este orden:**
1. Abrir Docker Desktop y probar la BD local, que **no se pudo verificar** (Docker estaba apagado):
   `npm run db:up`, luego `npm run database:migrate:all` con
   `DATABASE_URL=postgresql://xrlab:xrlab_dev@127.0.0.1:5433/xrlab`, y `npm run database:verify`.
   Después ejecutar `apps/api` contra esa BD: `DatabaseService` solo se probó con mocks.
2. Decidir el commit (propuesta: `feat: esqueleto NestJS (fases 0 y 1)`).
3. Empezar la Fase 2 (auth propio). Necesita estas decisiones del usuario:
   - Proveedor de correo para invitación/reset (propuesta: Resend, API HTTP, plan gratis).
   - Fase 5: opción A (importar usuarios y que definan contraseña nueva) u opción B (migrar hashes de Firebase).
   - Subir zod a >= 4.6.6 antes de validar bodies de usuario (ver "Deuda conocida").
4. El `DATABASE_URL` de Neon todavía no se ha usado ni compartido; va solo en `apps/api/.env` (ignorado por git),
   con el host `-pooler`.

**Cómo correr lo que hay:** `cd apps/api`, copiar `.env.example` a `.env`, `npm test`, `npm run start:dev`
(escucha en `http://localhost:3000/api/health`).

## Objetivo

Dejar de usar Firebase (Functions, Auth y Hosting) y pasar a un backend propio en NestJS, monolito
modular, manteniendo las funciones principales de XRLAB: registro de asistencia por QR/quiosco,
administración, auditoría y registros manuales. Todo debe poder correr en planes gratuitos.

## Situación de partida

- Backend: app Express con 28 rutas en `/api/{auth,kiosk,attendance,admin}`, empaquetada como una sola
  Firebase Function (`xrlabApi`). Usa Postgres (Neon) con `pg` y SQL escrito a mano.
- Dependencias reales de Firebase: Firebase Auth (`verifyIdToken`, `createUser`, custom claims con el rol,
  correo de invitación/reset), Firebase Hosting (sirve Angular y reescribe `/api/**`) y los paquetes
  `firebase-functions` / `firebase-admin`.
- Frontend: Firebase solo se usa en `apps/web/src/app/core/services/auth.service.ts`. El resto va por
  `ApiClientService` con un Bearer token.
- BD: `users_profiles.firebase_uid` es la llave que une Firebase con Postgres.
- Los scripts `functions/scripts/pc{1..4}-verify-*.mjs` prueban los flujos de punta a punta y sirven como
  red de seguridad de la migración.

## Decisiones

| Tema | Decisión |
|---|---|
| Estructura | Monolito modular en `apps/api`, junto a `apps/web`. `functions/` se elimina en la Fase 6. |
| Versión de Nest | **Nest 11 (CJS) + TypeScript 5.9 + Jest.** Nest 12 es solo ESM y `ts-jest` aún no soporta TypeScript 7. Subir a Nest 12 queda como tarea posterior. |
| Acceso a datos | SQL con `pg` detrás de un `DatabaseService`. Un ORM se evalúa después, no ahora. |
| Auth | JWT de acceso corto + refresh token rotativo (hash en BD). Contraseñas con argon2. |
| Contrato HTTP | Se mantiene el prefijo `/api`, el envelope `{ ok, data, message, requestId }` y los códigos de error. |
| Correo | API HTTP de un proveedor (p. ej. Resend, plan gratis), **no SMTP**: Render puede bloquear los puertos SMTP en el plan gratis. |
| Hosting backend | Render (web service gratis). |
| Base de datos | Neon (plan gratis), con la cadena `-pooler`. |
| Hosting frontend | A decidir en la Fase 6: Static Site de Render o Firebase Hosting solo para el frontend. |

## Restricciones del plan gratis

- **Render:** 750 h/mes por workspace (alcanza para una instancia 24/7), se duerme tras 15 min sin tráfico
  y tarda entre 1 y 2 min en despertar.
- **Neon:** el cómputo se suspende a los 5 min sin actividad (no configurable) y hay un tope de 100 CU-horas
  al mes por proyecto.
- **El health check NO debe tocar la BD.** Si un ping periódico (para mantener Render despierto) hiciera una
  consulta, Neon nunca se suspendería y se agotarían las CU-horas. `/api/health` solo responde desde memoria.
- Un ping externo gratuito (UptimeRobot, cron-job.org) cada 10-14 min mantiene Render despierto.

## Fases

### Fase 0 - Base y red de seguridad
- [x] Plan documentado.
- [x] `docker-compose.yml` con Postgres 16 para desarrollo local (puerto 5433).
- [x] `.env.example` completo para `apps/api`.
- [x] Scripts raíz `db:up`, `db:down` y `database:migrate:all`.
- [ ] **Pendiente de verificar:** `npm run db:up` y `npm run database:migrate:all` contra el Postgres local.
      No se pudieron probar porque Docker Desktop no estaba corriendo al momento de escribirlos.
- [ ] Los scripts `pcN-verify` ya aceptan `XRLAB_API_BASE_URL`, pero su login usa el emulador de Firebase Auth.
      Se reemplaza por un helper de login propio en la Fase 2.

### Fase 1 - Esqueleto Nest
- [x] `apps/api` con config validada con zod (`DATABASE_URL` obligatoria al arrancar).
- [x] `DatabaseService` (pool, `query`, `withTransaction`, reintento solo ante fallo de conexión).
- [x] `/api/health` sin tocar la BD.
- [x] helmet, CORS restringido por `CORS_ORIGINS`, rate limit global, request id.
- [x] Envelope de respuestas y filtro global de errores con el mismo formato que Express.
- [x] Tests unitarios y e2e.

### Fase 2 - Auth propio (lo más delicado)
- Migración `0004`: `password_hash` en `users_profiles`, tabla `auth_tokens` (invitación y reset, un solo uso,
  con expiración) y tabla `refresh_tokens`.
- Endpoints: `login`, `refresh`, `logout`, `set-password` (desde invitación), `forgot-password`, `session-check`.
- `JwtAuthGuard` + `@Roles()` en lugar de `requireAuth`; sigue validando contra el perfil activo en BD.
- `auth-accounts.service` se reescribe: genera el token de invitación y envía el correo.
- `firebase_uid` se conserva hasta el final para poder volver atrás.
- Rate limit específico en login. Revisión de seguridad obligatoria.
- Helper de login común para los scripts `pcN-verify`.

### Fase 3 - Portar módulos, de menor a mayor riesgo
1. `kiosk` + `qr-token`
2. `attendance`
3. `admin` (`admin-pc4.service.ts` de 1.523 líneas se divide en módulos: students, teachers, periods,
   kiosks, manual-records, audit, catalogs)

Por módulo: tests primero, luego el port y verificación con el script `pcN` correspondiente.

### Fase 4 - Frontend
- Reescribir `auth.service.ts` sin el SDK de Firebase (login contra la API, token en memoria, refresh, interceptor).
- Quitar `sendInvitationEmail` del cliente (lo envía el backend).
- Desinstalar `firebase` y limpiar los `environments`.

### Fase 5 - Datos y usuarios
- Opción A (recomendada): importar usuarios a `users_profiles` y enviar un correo de "define tu contraseña".
- Opción B: exportar hashes de Firebase (scrypt modificado) y verificarlos en el primer login.

### Fase 6 - Despliegue y limpieza
- Build/Dockerfile para Render, `render.yaml` versionado, health check en `/api/health`, ping anti-sueño.
- Eliminar `functions/`, `firebase.json`, emuladores y `firebase-debug.log` (está versionado).
- Actualizar los scripts del `package.json` raíz.

### Fase 7 - Calidad
- Cobertura mínima del 80 %, tests e2e con supertest, revisión de seguridad del auth y revisión de código.

## Deuda conocida tras la revisión de la Fase 1

Salió de la revisión de código del esqueleto (veredicto: aprobado, sin hallazgos críticos ni altos).
Ya corregido: el 201 de Nest se normaliza a 200 (paridad con Express), el `X-Request-Id` entrante se
valida con una lista de caracteres seguros y el filtro no escribe si los headers ya salieron.

Pendiente, y cuándo resolverlo:

- **Antes de portar `admin` (Fase 3):** el interceptor global envuelve toda respuesta. La exportación de
  `admin.routes.ts` (~línea 194) envía un `Buffer`; hace falta un `@RawResponse()` (o dejar pasar
  `Buffer`/`StreamableFile`) para no corromper la descarga.
- **Al desplegar (Fase 6):** definir `NODE_ENV=production` explícito en Render. Con el valor por defecto
  (`development`) no se activa `trust proxy` (el rate limit pasaría a ser un único bucket para todos los
  clientes) y `CORS_ORIGINS` deja de ser obligatorio. Valorar una variable propia para `trust proxy`.
- **Antes de validar bodies de usuario (Fase 2):** `npm audit` marca zod 3.25.76 (GHSA-mrhx-c7xc-m3w5,
  agotamiento de memoria con colecciones grandes). No es explotable hoy (solo valida `process.env`), pero
  hay que subir a zod >= 4.6.6 (cambios incompatibles: `required_error`, `ZodIssueCode`) o acotar con
  `.max()` los arrays de los schemas de request.
- **Fase 2, al añadir el primer POST y `ValidationPipe`:** agregar tests e2e con JSON malformado y body de
  más de 300 kb (hoy solo hay un test unitario con un error simulado) y decidir si el mensaje de
  `BAD_REQUEST` expone el detalle del parser o por campo.
- Menor: los tests e2e de rate limit y CORS tienen hardcodeados los valores de `test/setup-env.ts`.

## Riesgos

- Seguridad del auth propio: hashing, rotación de refresh, expiración de invitaciones, rate limit en login.
- Usuarios existentes: definir la Fase 5 antes de apagar Firebase.
- Regresiones: red de seguridad con `pcN-verify` y tests nuevos.
- Arranque en frío (Render + Neon): la primera petición tras un rato de inactividad puede tardar.
