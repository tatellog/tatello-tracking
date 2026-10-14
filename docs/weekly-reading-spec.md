# Lectura Semanal · spec (V-05 / V-06)

> EL feature del roadmap (`docs/product-vision-roadmap.md`, Fase 2): el
> momento recurrente donde el motor TE DEVUELVE algo. Compensación
> estructural de lo que el manifiesto decide no hacer (countdown, rachas,
> presión). 100% determinística: la IA no participa en la detección y hoy
> tampoco en la redacción.

Última actualización: 14 oct 2026 · rama `master-plan-integrity` (ST-010,
ver `docs/STELAR_MASTER_PLAN.md` §10).

---

## Estado

| Pieza                                        | Estado                                        |
| -------------------------------------------- | --------------------------------------------- |
| Motor puro (`_shared/intelligence/`)         | ✅ Construido, con tests (reglas ST-010)      |
| Tabla `weekly_readings` (RLS + inmutable)    | ✅ Migración aplicada                         |
| Edge `weekly-reading` (writer on-read-miss)  | ✅ Desplegada 14 oct 2026                     |
| Hooks cliente (Zod en el borde, cache × uid) | ✅ Construidos                                |
| Pantalla `/weekly-reading` (beats, sin ✦)    | ✅ Construida, con gate propio                |
| Entrada desde Hoy (tarjeta "Tu día")         | ✅ Avisa sin generar                          |
| Fila en Descubre (abrir / releer)            | ✅ Construida (14 oct 2026)                   |
| Card en Órbita Semana (`WeekSegment`)        | ⚠️ Código vivo pero no se monta (single feed) |
| N8 "tu lectura está lista" (push)            | ✅ Sin ✦; ya no se cancela el lunes           |
| Gating                                       | 🔒 Doble-gate a dev (ver abajo)               |
| Redacción IA opcional (gated)                | ❌ Pendiente                                  |
| Abrir a beta                                 | ❌ Pendiente de validación en dev build       |

---

## El motor · `supabase/functions/_shared/intelligence/weekly-reading.ts`

Puro y compartido server/cliente (re-export en
`features/orbit/weekly-reading.ts`). Nada de `Date.now()`: el "hoy" local
de la usuaria entra por parámetro.

- **Semana leída:** la última semana CERRADA (lunes→domingo), calculada
  con `lastClosedWeekStart(todayIso)`.
- **`buildWeeklyReading(signals, weekStartIso, ctx)`** ensambla:
  - ritmo de la semana: días con comida y días en déficit (`isDeficitDay`,
    banda sana). La apertura dice "N de M días con comida registrada", con
    M = días desde tu primer dato (nunca "3 de 7" si empezaste el jueves) y
    sin la cláusula de déficit cuando es 0;
  - gasto real: `adaptive-tdee` sobre la ventana de 28 días cerrados antes
    del lunes siguiente (la semana leída sí alimenta su propia lectura);
  - `paceKgWeek`: kg/semana SOLO con TDEE de calidad `solida` y con el
    promedio de días COMPLETOS (`dayQuality`); con TDEE temprano no hay
    kg ("Todavía es pronto para leer el ritmo de tu peso"). Ritmo ≈0 →
    "apunta a sostener tu peso";
  - el promedio de kcal que se muestra sin ritmo incluye parciales
    (excepción aceptada por la dueña, copy "en los días que registraste");
  - la conversación determinística en beats: `opening` + `body[]` +
    `lever` + `closing`.
- **Grados honestos** (nunca lectura fabricada):
  - `completa` — hay TDEE (con su `quality` sólida/temprana declarada);
  - `parcial` — hay semana registrada pero aún no TDEE; se dice qué falta;
  - `null` — menos de `WEEKLY_READING_MIN_DAYS = 3` días con comida →
    silencio (la superficie invita, no inventa, y NO se persiste nada:
    si la semana se completa por backfill, la lectura puede nacer después).
- **`weekHasReading(signals, weekStartIso)`:** la misma condición con la que
  el motor habla o calla, sin generar. Hoy y Descubre la usan para avisar.
- **La palanca** (`lever`): UNA, retrospectiva, con dato o `null`. Es FOCO
  recomendado, nunca receta (frontera del manifiesto):
  - `finde`: el finde pasó la meta Y su promedio de kcal fue mayor que el de
    entre semana (antes solo contaba días sobre la meta, H7);
  - `entre-semana`: ≥3 días entre semana en la banda SANA y ninguno sobre la
    meta (antes contaba días debajo del piso, H1);
  - `proteina`: ≥3 días completos con proteína (`countsForProteinAverage`)
    cerca de su meta.

Tests: `features/orbit/__tests__/weekly-reading.test.ts` (jest).

## Persistencia · tabla `weekly_readings`

Migraciones `20260717171349_weekly_readings.sql`,
`20260717171509_weekly_readings_freeze_search_path.sql` (advisor 0011) y
`20261014150000_weekly_readings_opened_at_guard.sql`.

- Una fila por `(user_id, week_start)` (unique). `payload` = la
  `WeeklyReading` completa (≤16 KB).
- RLS: select/insert/update solo `auth.uid() = user_id`.
- **Inmutable una vez emitida** (regla: lo histórico no recalcula): trigger
  `freeze_weekly_readings_before_update` — solo `opened_at` puede cambiar.
- `opened_at` = cuándo la abrió la usuaria → métrica norte "Insights
  Opened per Week". Nace null (`reset_weekly_readings_opened_before_insert`),
  solo pasa de null a `now()` (la hora la pone el servidor) y ya no cambia.

## Edge · `supabase/functions/weekly-reading/`

Writer **on-read-miss** (no hay cron): la usuaria pide su lectura → la fn
calcula con EL MISMO `buildWeeklyReading` del cliente, inserta si no existe
y la regresa. Si ya existe, devuelve la guardada tal cual (jamás recalcula).

- Corre con el **JWT de la usuaria** (client RLS-scoped, sin service role).
- `action: 'get'` (default) · `'open'` (marca `opened_at`, único mutable).
- El `todayIso` viaja del cliente (el server no conoce su timezone) y solo
  se acepta a ±1 día de la fecha del servidor: un reloj adelantado no puede
  congelar la lectura de una semana que sigue abierta.
- Carrera de dos aperturas simultáneas: benigna, el unique gana y la
  respuesta es idéntica por ser determinística.
- Imports `.ts` explícitos (regla Deno 2). **Deploy antes de merge a main**
  (regla del repo, igual que `scan-meal`).

## Cliente

- **Gating:** `weeklyReadingEnabledFor(email, is_beta)` (`lib/featureFlags.ts`):
  `WEEKLY_READING_ENABLED` + (cuentas dev O `profiles.is_beta`), vía
  `useWeeklyReadingOn()` en Hoy, Descubre, N8, Semana y la ruta
  `/weekly-reading`. El motor no gasta IA. Kill-switch: el master a `false`.
- **Hooks** (`features/orbit/weekly-reading-hooks.ts`): Zod en el borde,
  query key scopeada por uid (`queryKeys.orbit.weeklyReading`).
  - `useWeeklyReading` genera (on-read-miss): solo lo llama la pantalla.
    `staleTime` infinito para la lectura, 0 para el silencio (no se queda
    guardado en disco).
  - `useWeeklyReadingAvailability` avisa SIN generar: `weekHasReading` sobre
    las señales de la semana + `opened_at` leído directo de la tabla. La
    lectura se congela cuando la usuaria la abre, no cuando Hoy se monta.
  - `useMarkWeeklyReadingOpened` emite `insight_opened` (source
    `weekly_reading`) para TTFI.
- **Pantalla `/weekly-reading`:** beats uno a uno, SIN sello ✦ (regla de
  visibilidad: ✦ = solo lo que abre chat con IA real; esto es motor
  determinístico).
- **Hoy:** la tarjeta "Tu día" muestra "Tu lectura está lista" mientras hay
  lectura disponible sin abrir (`tuDiaModel`, prioridad 1).
- **Descubre:** `WeeklyReadingRow` bajo el día, para abrirla o releerla
  mientras la semana pasada tenga lectura.

---

## N8 · "tu lectura está lista"

- `features/notifications/`: slot `stelar-weekly-reading`, suena el LUNES en
  la ventana elegida, tap directo a `/weekly-reading`. Copy sin ✦.
- **Ganada por construcción:** `nextReadingDate` decide el lunes en que
  suena (hoy si es lunes y aún no es la hora; si no, el próximo) y
  `weeklyReadingGuaranteed(days, todayIso, readingIso)` mide la semana que
  ESE lunes lee. Antes medía la semana en curso, y abrir la app el lunes
  temprano cancelaba el push de ese día (H3).
- Arbitraje 1/día: ciclo > patrón (N3) > señal-órbita (N7) > **lectura** >
  sello > cierre. Doble-gateada con el resto de la feature.

## Pendientes (el resto de V-06)

1. **Validar en dev build:** pantalla, aviso en Hoy, fila en Descubre y N8
   (las notificaciones no corren en Expo Go).
2. **Beta:** el gate ya incluye `is_beta`; llega a las usuarias con el
   siguiente build. Criterio de éxito del roadmap: ≥60% de lecturas
   abiertas en beta.
3. **Bajos, registrados:** sin cron (semanas sin apertura no tienen
   lectura); un insert directo por PostgREST con la propia sesión puede
   fabricar un payload (solo su fila); la meta usada es la actual, no la
   vigente esa semana.
4. **Redacción IA opcional y gated:** la IA explica lo ya detectado
   (patrón de `stelar-insight`); la lectura funciona 100% sin IA. Solo
   entonces aparecería el sello ✦.

## Reglas que esta feature no puede romper

- Con dato o silencio: cero frases genéricas, cero lecturas fabricadas.
- La palanca recomienda un foco; nunca receta dieta/rutina/clínico.
- Lo emitido no se recalcula ni retrocede (inmutabilidad dura en DB).
- Sin ✦ mientras no haya IA real detrás.
- Máximo una notificación por lectura.
- Las mismas reglas de integridad que el resto del motor: banda sana del
  déficit, denominadores desde que empezaste, promedios de días completos.
