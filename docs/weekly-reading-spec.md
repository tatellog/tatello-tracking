# Lectura Semanal · spec (V-05 / V-06)

> EL feature del roadmap (`docs/product-vision-roadmap.md`, Fase 2): el
> momento recurrente donde el motor TE DEVUELVE algo. Compensación
> estructural de lo que el manifiesto decide no hacer (countdown, rachas,
> presión). 100% determinística: la IA no participa en la detección y hoy
> tampoco en la redacción.

Última actualización: 23 jul 2026 · rama `vision-fase-1`.

---

## Estado

| Pieza                                        | Estado                               |
| -------------------------------------------- | ------------------------------------ |
| Motor puro (`_shared/intelligence/`)         | ✅ Construido, con tests             |
| Tabla `weekly_readings` (RLS + inmutable)    | ✅ Migración aplicada                |
| Edge `weekly-reading` (writer on-read-miss)  | ✅ Construida                        |
| Hooks cliente (Zod en el borde, cache × uid) | ✅ Construidos                       |
| Pantalla `/weekly-reading` (beats, sin ✦)    | ✅ Construida                        |
| Card en Órbita Semana (`WeekSegment`)        | ✅ Construida                        |
| Gating                                       | 🔒 Doble-gate a dev (ver abajo)      |
| N8 "tu lectura está lista" (push)            | ✅ Construida (23 jul)               |
| Entrada desde Hoy (lectura nueva sin abrir)  | ✅ Construida (23 jul)               |
| Redacción IA opcional (gated)                | ❌ Pendiente                         |
| Abrir a beta                                 | ❌ Pendiente de validación en device |

---

## El motor · `supabase/functions/_shared/intelligence/weekly-reading.ts`

Puro y compartido server/cliente (re-export en
`features/orbit/weekly-reading.ts`). Nada de `Date.now()`: el "hoy" local
de la usuaria entra por parámetro.

- **Semana leída:** la última semana CERRADA (lunes→domingo), calculada
  con `lastClosedWeekStart(todayIso)`.
- **`buildWeeklyReading(signals, weekStartIso, ctx)`** ensambla:
  - ritmo de la semana: días con comida, días en déficit (`deficit.ts`),
    promedio de kcal de los días registrados;
  - gasto real: `adaptive-tdee` sobre la ventana de 28 días cerrados antes
    del lunes siguiente (la semana leída sí alimenta su propia lectura);
  - `paceKgWeek`: kg/semana estimados al ritmo actual (redondeo a 0.05);
  - la conversación determinística en beats: `opening` + `body[]` +
    `lever` + `closing`.
- **Grados honestos** (nunca lectura fabricada):
  - `completa` — hay TDEE (con su `quality` sólida/temprana declarada);
  - `parcial` — hay semana registrada pero aún no TDEE; se dice qué falta;
  - `null` — menos de `WEEKLY_READING_MIN_DAYS = 3` días con comida →
    silencio (la superficie invita, no inventa, y NO se persiste nada:
    si la semana se completa por backfill, la lectura puede nacer después).
- **La palanca** (`lever`): UNA, retrospectiva, con dato o `null`. Kinds:
  `finde` (el finde fue lo más alto), `entre-semana` (sostuviste la meta),
  `proteina` (se mantuvo cerca de su meta). Es FOCO recomendado, nunca
  receta (frontera del manifiesto): señala dónde vive el espacio, no qué
  comer ni cuánto.

Tests: `features/orbit/__tests__/weekly-reading.test.ts` (jest).

## Persistencia · tabla `weekly_readings`

Migración `20260717120000_weekly_readings.sql` (aplicada a prod; advisor
0011 sellado en `fn_weekly_readings_freeze`).

- Una fila por `(user_id, week_start)` (unique). `payload` = la
  `WeeklyReading` completa (≤16 KB).
- RLS: select/insert/update solo `auth.uid() = user_id`.
- **Inmutable una vez emitida** (regla: lo histórico no recalcula): trigger
  `freeze_weekly_readings_before_update` — solo `opened_at` puede cambiar.
- `opened_at` = cuándo la abrió la usuaria → métrica norte "Insights
  Opened per Week".

## Edge · `supabase/functions/weekly-reading/`

Writer **on-read-miss** (no hay cron): la usuaria pide su lectura → la fn
calcula con EL MISMO `buildWeeklyReading` del cliente, inserta si no existe
y la regresa. Si ya existe, devuelve la guardada tal cual (jamás recalcula).

- Corre con el **JWT de la usuaria** (client RLS-scoped, sin service role).
- `action: 'get'` (default) · `'open'` (marca `opened_at`, único mutable).
- El `todayIso` viaja del cliente (el server no conoce su timezone; regla
  del repo: America/Mexico_City vive en el cliente).
- Carrera de dos aperturas simultáneas: benigna, el unique gana y la
  respuesta es idéntica por ser determinística.
- Imports `.ts` explícitos (regla Deno 2). **Deploy antes de merge a main**
  (regla del repo, igual que `scan-meal`).

## Cliente

- **Gating (doble):** `WEEKLY_READING_ENABLED` (`lib/featureFlags.ts`,
  hoy `true`) + `aiEnabledForEmail` (dev). Para abrir a beta: quitar el
  gate devOnly en la superficie — el motor no gasta IA, abrirla no toca el
  presupuesto de OpenAI.
- **Hooks** (`features/orbit/weekly-reading-hooks.ts`): Zod en el borde,
  query key scopeada por uid (`queryKeys.orbit.weeklyReading`),
  `staleTime: Infinity` (inmutable por diseño). `useMarkWeeklyReadingOpened`
  emite `insight_opened` (source `weekly_reading`) para TTFI.
- **Pantalla `/weekly-reading`:** beats uno a uno, SIN sello ✦ (regla de
  visibilidad: ✦ = solo lo que abre chat con IA real; esto es motor
  determinístico).
- **Card en Órbita Semana** (`WeekSegment`): junto al sello del lunes; la
  cita del lunes existente aterriza ahí.

---

## N8 + entrada desde Hoy (construidas 23 jul 2026)

- **N8 "tu lectura está lista"** (`features/notifications/`): slot
  `stelar-weekly-reading`, suena el LUNES en la ventana elegida, tap
  directo a `/weekly-reading` (target nuevo en `response.ts`). **Ganada
  por construcción:** solo se agenda cuando `weeklyReadingGuaranteed`
  confirma que la semana en curso ya juntó los días mínimos del motor
  (monotónico: la promesa no puede romperse). Arbitraje 1/día: ciclo >
  patrón (N3) > señal-órbita (N7) > **lectura** > sello > cierre — la
  lectura absorbe al sello del lunes (es su contenido, mejorado) y cede a
  los tres mayores. Doble-gateada a dev con el resto de la feature.
- **Entrada desde Hoy** (`WeeklyReadingStrip`): tira junto a la lectura
  del día, SOLO mientras hay lectura sin abrir; se retira sola al leerla
  (la pantalla marca `opened_at` e invalida la query). Sin tracking
  propio: `insight_opened` lo emite una sola vez la pantalla.

## Pendientes (el resto de V-06)

1. **Redacción IA opcional y gated:** la IA explica lo ya detectado
   (patrón de `stelar-insight`); la lectura funciona 100% sin IA. Solo
   entonces aparecería el sello ✦.
2. **Abrir a beta** tras validar en dev build (pantalla, card, tira de Hoy
   y N8 — las notificaciones necesitan dev build, no Expo Go). Criterio de
   éxito del roadmap: ≥60% de lecturas abiertas en beta.

## Reglas que esta feature no puede romper

- Con dato o silencio: cero frases genéricas, cero lecturas fabricadas.
- La palanca recomienda un foco; nunca receta dieta/rutina/clínico.
- Lo emitido no se recalcula ni retrocede (inmutabilidad dura en DB).
- Sin ✦ mientras no haya IA real detrás.
- Máximo una notificación por lectura (cuando exista N8).
