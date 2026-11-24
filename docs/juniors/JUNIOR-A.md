# Junior A — tests, README y Dockerfile

Lee primero las [reglas comunes](./README.md). Todo lo de esta tarea son **archivos nuevos**: no se edita
ningún archivo existente.

Antes de empezar, desde `apps/api`: `npm install`, `npx jest` (deben pasar todos) y mira cómo están escritos
`src/auth/auth.service.spec.ts` y `src/auth/jwt-auth.guard.spec.ts`: son el modelo de estilo a seguir.

## A1. Tests unitarios de piezas del auth (rama `junior-a/tests-auth`)

Solo se **crean** estos archivos. No se modifica el código que prueban: si crees que encontraste un bug,
no lo arregles, avísalo.

| Archivo nuevo | Qué prueba |
|---|---|
| `src/auth/token.service.spec.ts` | `hashOpaqueToken` y `TokenService` |
| `src/auth/password.service.spec.ts` | `PasswordService` |
| `src/common/zod-body.pipe.spec.ts` | `ZodBodyPipe` |
| `src/auth/mail.service.spec.ts` | `MailService` |

Casos mínimos:

- **TokenService**
  - `hashOpaqueToken` devuelve siempre el mismo sha256 en hex (64 caracteres) para la misma entrada y uno
    distinto para entradas distintas.
  - `generateOpaqueToken` devuelve `token` y `hash`; el `hash` coincide con `hashOpaqueToken(token)`; dos
    llamadas seguidas dan tokens distintos.
  - `verifyAccessToken` devuelve el payload cuando `JwtService.verifyAsync` devuelve `sub` y `role` válidos, y
    `null` cuando falla, cuando falta `sub` o cuando `role` no es `ADMIN`/`TEACHER`/`STUDENT`.
    (`JwtService` se simula con `jest.fn()`; no se usa un JWT real.)
- **PasswordService**
  - `hash` produce un string que empieza con `$argon2id$` y que no contiene la contraseña.
  - `verify` es `true` con la contraseña correcta y `false` con otra.
  - `verify` es `false` (no lanza error) si el hash está corrupto, por ejemplo `'no-es-un-hash'`.
  - `verifyDummy` siempre devuelve `false`.
- **ZodBodyPipe**
  - Con un schema simple (`z.object({ nombre: z.string() })`): un body válido se devuelve tal cual; uno inválido
    lanza `ApiError` con `code` `VALIDATION_ERROR` y status 400, y el mensaje menciona el campo con problema.
- **MailService**
  - Sin `RESEND_API_KEY`: no llama a `fetch` y no lanza error.
  - Con clave: llama a `fetch` una vez con la URL `https://api.resend.com/emails`, método `POST`, el header
    `Authorization: Bearer <clave>` y un body JSON con `to`, `subject` y `text`.
  - Si `fetch` responde `ok: false` (por ejemplo 500) lanza un error.
  - Para simular `fetch`: `jest.spyOn(globalThis, 'fetch')` y restaurarlo en `afterEach`.

**Listo cuando:** `npx jest` pasa con los 4 archivos nuevos y `git status` solo muestra esos 4.

## A2. README de la API (rama `junior-a/readme-api`)

Crear `apps/api/README.md` (archivo nuevo) en español, con estas secciones:

1. Qué es (backend NestJS de XRLAB, reemplaza a Firebase Functions).
2. Requisitos (Node 22 o superior).
3. Puesta en marcha: copiar `.env.example` a `.env`, rellenar `DATABASE_URL` y `JWT_ACCESS_SECRET`
   (con el comando para generarlo que aparece en `.env.example`), `npm install`, `npm run start:dev`.
4. Tabla de las variables de entorno (nombre, obligatoria sí/no, valor por defecto, para qué sirve),
   leyéndolas de `src/config/env.schema.ts`.
5. Scripts disponibles (`npm run ...`), leídos de `package.json`.
6. Endpoints de auth (`/api/auth/*`), leídos de `src/auth/auth.controller.ts`: método, ruta, si exige sesión.
7. Cómo correr los tests.

**Listo cuando:** alguien que no conoce el proyecto puede levantar la API siguiendo solo ese README.
**No pongas** valores reales de ninguna variable.

## A3. Dockerfile de la API (rama `junior-a/dockerfile`)

Crear **solo** `apps/api/Dockerfile` y `apps/api/.dockerignore` (archivos nuevos; nada los referencia todavía).

- Build en dos etapas: la primera instala dependencias y ejecuta `npm run build`; la segunda copia `dist/` y
  las dependencias de producción (`npm ci --omit=dev`).
- Imagen base `node:22-slim` (evita problemas con el módulo nativo `argon2` que da alpine).
- Corre como usuario sin privilegios (`USER node`), expone el puerto 3000 y arranca con `node dist/main.js`.
- `.dockerignore` debe excluir `node_modules`, `dist`, `coverage`, `.env` y `.env.*` (pero no `.env.example`).
- Nunca copiar el archivo `.env` a la imagen.

**Listo cuando:** `docker build -t xrlab-api apps/api` termina sin errores (requiere Docker Desktop encendido;
si no puedes probarlo, dilo en el PR en lugar de afirmar que funciona).
