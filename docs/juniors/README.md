# Guía para juniors — migración a NestJS

Dos tareas independientes, pensadas para que **no se pueda romper nada**: cada una solo **agrega archivos
nuevos** que ninguna parte de la app usa todavía. Si algo sale mal, se descarta la rama y no pasó nada.

- [Junior A: tests, README y Dockerfile](./JUNIOR-A.md)
- [Junior B: portar la lógica del QR](./JUNIOR-B.md)

## Reglas (valen para los dos)

1. **Una rama por tarea**, creada desde `feat/migracion-nest`: `junior-a/<tarea>` o `junior-b/<tarea>`.
   Nunca se trabaja directo sobre `feat/migracion-nest` ni sobre `main`.
2. **Un pull request por tarea**, hacia `feat/migracion-nest`. Lo revisa y aprueba el responsable (ver
   `.github/CODEOWNERS`). No se hace merge propio.
3. **Solo se tocan los archivos que la tarea lista.** Está prohibido editar, sin pedir permiso antes:
   - `apps/api/src/auth/**` (autenticación)
   - `apps/api/src/config/**`, `apps/api/src/database/**`, `apps/api/src/app.module.ts`, `apps/api/src/app.setup.ts`
   - `database/**` (migraciones y seeds)
   - `apps/api/package.json` y `package-lock.json` (si necesitan una dependencia nueva, preguntar primero)
   - `functions/**` (es el backend viejo: **solo se lee**, no se modifica)
   - cualquier archivo `.env`
4. **Antes de abrir el PR**, desde `apps/api` deben pasar los tres comandos:
   ```bash
   npx tsc --noEmit -p tsconfig.json
   npx jest
   git status        # solo deben aparecer los archivos de la tarea
   ```
5. **Nunca** se suben secretos, contraseñas, tokens ni archivos `.env`. Los valores de prueba son inventados.
6. **Los tests no usan la base de datos ni la red.** Si un test necesita Postgres, se simula con mocks.
7. Código en TypeScript estricto, sin `any`, sin `console.log`, funciones de menos de 50 líneas, comentarios
   en español (como el resto del proyecto).
8. Si algo no está claro o un test falla y no se entiende por qué: **preguntar antes de seguir**. Es mejor
   una pregunta que un cambio fuera de la lista.

## Cómo se ve un buen PR

- Título tipo `test(auth): pruebas de TokenService` (formato `tipo: descripción`).
- Descripción corta: qué se hizo y cómo se comprobó (pegar el resumen de `npx jest`).
- Solo los archivos de la tarea, sin formateos masivos de otros archivos.
