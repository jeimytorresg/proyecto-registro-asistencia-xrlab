# Junior B — portar la lógica del QR

Lee primero las [reglas comunes](./README.md). Esta tarea porta código **puro** (sin base de datos, sin HTTP)
del backend viejo al nuevo. Todo son **archivos nuevos** dentro de una carpeta nueva `apps/api/src/qr/`;
nada los importa todavía, así que no pueden afectar a la API en funcionamiento.

El código de origen está en `functions/src` y **solo se lee**.

## B1. Tipos del QR (rama `junior-b/qr-tipos`)

- Origen: `functions/src/domain/qr-token.ts`
- Destino (nuevo): `apps/api/src/qr/qr-token.types.ts`
- Copiar las interfaces `QrTokenPayload`, `SignedQrToken` y `QrBatch` tal cual. Sin lógica ni cambios de
  nombres.

**Listo cuando:** `npx tsc --noEmit -p tsconfig.json` sigue limpio.

## B2. Funciones de firma y verificación del QR (rama `junior-b/qr-token`)

Depende de B1 (puedes hacerlo en la misma rama si lo prefieres).

- Origen: `functions/src/services/qr-token.service.ts` (funciones `isQrPayloadExpired`, `generateQrToken`,
  `generateQrBatch`, `verifyQrToken` y los helpers que usen).
- Destino (nuevo): `apps/api/src/qr/qr-token.ts`
- Cambios obligatorios respecto al original:
  1. Importar `ApiError` desde `../common/api-error` (ya existe en la API nueva) y los tipos desde
     `./qr-token.types`. Sin extensiones `.js` en los imports.
  2. **Ninguna función lee `process.env`.** La clave de firma y los tiempos (TTL, rotación) llegan como
     parámetros. Si el original los lee del entorno, conviértelos en un argumento (por ejemplo un objeto
     `QrSigningConfig`).
  3. Mantener exactamente los mismos códigos de error y mensajes que el original: el frontend depende de ellos.
  4. Mantener `timingSafeEqual` para comparar firmas. No lo cambies por `===`.
- **No** crear módulos, controllers ni providers de Nest, y **no** tocar `env.schema.ts` ni `app.module.ts`:
  el responsable los conecta después.

**Listo cuando:** compila y los tests de B3 pasan.

## B3. Tests del QR (misma rama que B2)

Crear `apps/api/src/qr/qr-token.spec.ts` (nuevo). Sin base de datos ni red; usa una clave inventada de 32
caracteres o más.

Casos mínimos:

- Un token recién generado se verifica correctamente y devuelve su payload (`kioskId`, `kioskSessionId`, `seq`).
- Un token con el payload alterado (cambia un carácter) es rechazado.
- Un token firmado con otra clave es rechazado.
- Un token vencido es rechazado y `isQrPayloadExpired` devuelve `true`; uno vigente devuelve `false`.
  (Controla el tiempo con `jest.useFakeTimers()` y `jest.setSystemTime(...)`; no uses `sleep`.)
- Un string sin formato válido (vacío, sin separador, base64 inválido) es rechazado sin lanzar una excepción
  inesperada: debe ser un `ApiError`.
- `generateQrBatch` devuelve la cantidad de tokens esperada, con `seq` consecutivos y `jti` únicos.
- Los errores lanzados son `ApiError` con el `code` del original.

**Listo cuando:** `npx jest` pasa y `git status` solo muestra los 3 archivos nuevos de `apps/api/src/qr/`.

## Si te atoras

El original funciona; la meta es que el nuevo se comporte **igual**. Si algo del original no se entiende o
parece un bug, no lo "arregles": déjalo igual, anótalo en la descripción del PR y pregunta.
