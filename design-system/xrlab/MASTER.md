# XRLAB: Sistema de diseño (MASTER)

Fuente de verdad visual. Los tokens viven en `tokens.css`. Las excepciones por pantalla van en `pages/<nombre>.md` y ganan sobre este archivo.

## 1. Sujeto, audiencia y trabajo principal

Registro de asistencia, permanencia y evidencia de actividades del laboratorio de realidad extendida (XR) de la UTPL.

| Contexto | Quién | Dispositivo | Trabajo principal |
|---|---|---|---|
| Estudiante | Alumno en el laboratorio | Celular, de pie | Registrar entrada/salida escaneando un QR sin dudar |
| Kiosko | Docente/admin deja la pantalla fija | Monitor o tablet, leído a 2-3 m | Mostrar un QR que rota cada 10 s |
| Admin y docente | Personal | Escritorio, a veces móvil | Saber quién está dentro, revisar y corregir registros |

Decisiones del cliente: mantener la marca azul/amarillo, solo modo claro, se permiten librerías de UI, incluir las 4 páginas placeholder.

## 2. Dirección

Swiss Modernism sobrio: rejilla clara, jerarquía por tamaño y peso, bordes finos en lugar de sombras, color con significado.

- **El azul es estructura y tinta.** Texto, navegación activa y acción primaria.
- **El amarillo es señal de "vivo".** Solo aparece en: QR activo y anillo del kiosko, estado "dentro del lab", y el CTA único de cada pantalla. Nunca como decoración ni como color de texto sobre fondo claro.
- **Lo memorable está en un solo lugar:** el kiosko (QR enorme + anillo de cuenta regresiva de 10 s). Todo lo demás es silencioso.

### Revisión contra los defaults de IA (hecha antes de construir)

| Tell común | Estado en este sistema |
|---|---|
| Crema + serif + terracota | No. Papel frío, sans, sin terracota |
| Negro tintado + acento ácido | No. Solo modo claro |
| Tarjetas idénticas con una sombra | Se evita: radios por jerarquía, bordes, sombra solo en elementos flotantes |
| Eyebrow en MAYÚSCULAS sobre cada h1 | Prohibido. Las pantallas abren con el título y la acción |
| Numeración 01/02/03 | Solo si el contenido es una secuencia real |
| Un solo énfasis de color en una palabra del titular | Prohibido |
| Fade-in por sección + hover en cada tarjeta | Prohibido. Un solo momento orquestado (anillo del QR) |
| Mono para etiquetas, `→` en botones, `A · B · C` | Prohibido |
| Párrafo `lead` explicando la tecnología | Prohibido. Se explica qué hacer, no cómo está construido |

### Pantalla de referencia: el login (acordada con el cliente)

El login fija el lenguaje visual que siguen las demás fases. Es moderno, con contraste marcado y sin cajas innecesarias.

- **Composición dividida 60/40.** Zona de trabajo a la izquierda sobre `--paper`, **sin tarjeta contenedora**. Panel de mensaje a la derecha en `--blue-900`, con un titular grande y un texto corto.
- **Controles grandes y generosos:** campos y botón de 60 px de alto, texto de 19 px, radio 10.
- **Un motivo gráfico por pantalla, nunca más:** los anillos concéntricos con el arco amarillo (eco del anillo del QR). Es decorativo, estático y con `aria-hidden`.
- **Sin logotipo ni marca repetida** dentro del panel.
- **Móvil:** el panel pasa arriba como banda compacta (solo titular); el contenido va debajo.
- Aplicación a las demás fases: el kiosko usa el panel oscuro y los anillos como protagonista; el estudiante abre con una banda oscura corta y el contenido sobre `--paper`; en admin el panel oscuro vive en la sidebar y las zonas de trabajo no llevan tarjeta si una línea o un espacio bastan.

## 3. Color

| Token | Hex | Uso |
|---|---|---|
| `--blue-900` (ink) | `#0A2540` | Texto principal, fondo del kiosko |
| `--blue-700` | `#004270` | Acción primaria, navegación activa, foco |
| `--yellow-500` | `#FEBE10` | Señal viva (ver §2) |
| `--paper` | `#F6F8FA` | Fondo de página |
| `--surface` | `#FFFFFF` | Paneles, inputs |
| `--line` | `#D9E1E8` | Bordes y divisores |

Contrastes verificados: `--ink` sobre `--paper` 14:1, `--ink-3` sobre `--paper` 5.6:1, `--blue-900` sobre `--yellow-500` 9:1. Estados con fondo suave más texto oscuro, e ícono siempre presente.

Botón primario: fondo `--yellow-500`, texto `--blue-900`. Solo uno por vista. Los demás son `--blue-700` (secundario, borde) o texto.

## 4. Tipografía

Una familia: **Schibsted Grotesk** (400, 500, 600, 700). Carga con `font-display: swap`. Se cargará en la Fase 1 y se confirmará que rinde bien con tildes y ñ. Si falla, `system-ui`.

Escala (solo estos tamaños): caption 13, label 14, body 16, title 20, headline 28, display 36-48. El kiosko usa `--fs-kiosk`.

- Línea máxima 70 caracteres. Interlínea de cuerpo 1.55, de títulos 1.15.
- Cifras tabulares (`font-variant-numeric: tabular-nums`) solo en celdas y contadores numéricos (clase `.num` / `.tabular`). Nunca en una tabla o un texto completo: en Schibsted Grotesk el modo tabular ensancha puntos y dos puntos y deforma correos y fechas.
- Sin mayúsculas sostenidas en etiquetas. Etiquetas de columna en sentido normal, peso 600.

## 5. Layout y navegación

- Mobile-first. Breakpoints: 640, 960, 1280.
- Contenido máximo 1200 px. Alineación a la izquierda, sin centrado de párrafos.
- **Admin/docente:** sidebar fija de 248 px desde 960 px. Debajo de 960 px, barra inferior de 64 px con máximo 5 ítems; el resto va en "Más".
- **Estudiante:** sin sidebar. Cabecera mínima (nombre + salir). La cámara ocupa el ancho; el resultado sube como hoja inferior.
- **Kiosko:** pantalla completa, sin navegación. Dos elementos: QR y datos de sesión.
- Una sola navegación por rol (se elimina la duplicada topbar/sidebar).

## 6. Componentes (Fase 1)

| Componente | Reglas |
|---|---|
| Botón | Alto mín. 44 px, radio 8. Variantes: primario (amarillo), secundario (borde azul), texto, peligro. Estado de carga con texto de acción ("Registrando…"), sin quitar el ancho |
| Campo | Etiqueta visible siempre. Error debajo del campo con `aria-describedby`. Sin placeholder como etiqueta |
| Badge de estado | Píldora con ícono + texto: "Dentro", "Salió", "Incompleta", "Manual" |
| Alerta | Ícono + título corto + qué hacer. Errores sin disculpas ni vaguedad |
| Estado vacío | Qué falta y la acción para resolverlo |
| Tabla | Escritorio: tabla con cabecera fija y cifras tabulares. Menos de 640 px: lista de filas apiladas (no scroll horizontal) |
| Hoja inferior | Radio 20, sombra flotante, foco atrapado (Angular CDK) |
| Filtros | Panel colapsable; en móvil, hoja inferior |

Iconos: SVG de `lucide-angular` (trazo 1.75). No emoji.

## 7. Movimiento

- Un momento orquestado: el anillo de cuenta regresiva del QR.
- Movimiento que responde a acciones: resultado del escaneo (sube la hoja), confirmaciones, expandir filtros.
- Duraciones: 120 ms (hover/press), 200 ms (estado), 280 ms (hoja). Solo `transform` y `opacity`.
- `prefers-reduced-motion`: duraciones a 0 (ya en `tokens.css`).

## 8. Voz y copy

- Español neutro, oraciones normales, verbos activos. Sin "Submit"/"Enviar" genérico: "Registrar entrada", "Confirmar salida", "Guardar cambios".
- La misma acción tiene el mismo nombre en botón, confirmación y bitácora.
- Nada de jerga interna: se eliminan "PC1/PC2/PC3/PC4", nombres de enums (`ENTRY_REGISTERED`), IDs de registro y fechas ISO.
- Fechas con `Intl.DateTimeFormat('es-EC')`. Duraciones como "2 h 15 min".
- Errores: qué pasó + cómo resolverlo ("El QR venció. Escanea el que aparece ahora en la pantalla").

## 9. Librerías aprobadas

| Librería | Para qué | Motivo |
|---|---|---|
| `@angular/cdk` | Hoja inferior, diálogos, trampa de foco, `LiveAnnouncer` | Accesibilidad resuelta sin imponer estilos |
| `lucide-angular` | Iconos SVG | Ligera, consistente, tree-shakeable |

No se adopta Material/PrimeNG: impondrían un look reconocible y chocarían con este sistema.

## 10. Checklist de entrega por pantalla

- [ ] Se ve bien a 360, 768 y 1280 px; sin scroll horizontal
- [ ] Contraste de texto 4.5:1 o más; foco visible; navegable por teclado
- [ ] Áreas táctiles de 44 px o más con 8 px de separación
- [ ] Estados: cargando, vacío, error y éxito
- [ ] Sin emoji, sin eyebrow en mayúsculas, sin jerga interna
- [ ] Solo tokens (ningún hex suelto en componentes)
- [ ] `prefers-reduced-motion` respetado
