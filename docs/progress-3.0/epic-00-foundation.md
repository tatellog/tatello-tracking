# Epic 00 · Progress Foundation

**Status:** Draft · **Priority:** P0 · **Depende de:** nada (es la base)

---

## Objetivo

Construir la **base técnica** de Progress. Esta épica NO agrega funcionalidades
visibles: prepara la arquitectura para que las épicas 01–07 crezcan **sin
refactors**.

## Alcance

- Navegación del módulo.
- Estructura de carpetas (consolidar lo que ya vive suelto en `features/progress/`).
- Componentes reutilizables.
- Contratos de datos (tipos inferidos de Zod).
- Servicios (`api.ts` + `hooks.ts`).

## No incluye

IA · insights · conversaciones · metacognición. (Todo eso llega en 03–05.)

---

## Arquitectura (decisión · jul 2026)

La versión larga del brief pedía carpetas `repository / mappers / domain-models /
services / navigation / analytics`. Eso **contradice** la convención documentada
del repo (`frontend.md`, `architecture.md`, ADR-0001, `CLAUDE.md`) y crearía un
island divergente (anti-patrón que los docs marcan, ADR-0002). **Decisión: se
cumple el MISMO objetivo (UI desacoplada de Supabase, SOLID, listo para crecer)
mapeando a la convención existente**, sin capas nuevas:

| Intención                 | Dónde vive en el repo                                                |
| ------------------------- | -------------------------------------------------------------------- |
| Repository (getHistory…)  | `features/progress/api.ts` (Zod+Supabase, único que conoce Supabase) |
| Mapper (Supabase→dominio) | el `.parse()`/transform de Zod dentro de `api.ts`                    |
| Domain models             | `features/progress/types.ts` (`z.infer` + forward-contracts)         |
| Services / data access    | `hooks.ts` (React Query) + `logic.ts` (puro)                         |
| Estados de pantalla       | `ProgressState<T>` en `types.ts`                                     |
| Navigation / screens      | Expo Router file-based (`app/(tabs)/progress.tsx`)                   |
| Analytics                 | catálogo en `constants.ts` sobre `lib/analytics.ts`                  |
| Feature flags             | `lib/featureFlags.ts` (centralizado)                                 |
| Query keys                | `lib/queryKeys.ts` (centralizado)                                    |

**Entregado en Epic 00:** `types.ts` (domain models + `ProgressState` +
forward-contracts de 01-07), `constants.ts` (catálogo de eventos + ventanas),
flags `PROGRESS_*` (History ON, resto OFF), y las query keys de progress
centralizadas (antes eran strings sueltos en `hooks.ts`). La UI y las
funcionalidades existentes **no cambian**.

---

## Frontend

Componentes/pantallas a crear o consolidar (kebab-case archivos, PascalCase
componentes). Reutilizar los que ya existen en `features/progress/components/`:

| Pieza                                | Estado en el repo                                         |
| ------------------------------------ | --------------------------------------------------------- |
| `ProgressStack` / `ProgressLayout`   | nuevo — layout del tab                                    |
| `HistoryTab` / `BodyTab`             | nuevo — los dos segmentos (Epic 01 / 02)                  |
| `ProgressHeader` / `ProgressSection` | nuevo — cabecera + secciones                              |
| `MetricCard`                         | reusar/renombrar desde `HeroStat` / `ComparativaCard`     |
| `ComparisonCard`                     | existe: `ComparativaCard.tsx`                             |
| `PhotoComparison`                    | existe: `BeforeAfterSlider.tsx` / `BeforeAfterPhotos.tsx` |
| `Timeline`                           | nuevo — el slider temporal (base para Epic 01/02)         |

Patrón visual: tokens de `theme/` (fondo `#0A0608`, leche, magenta, oro para
ceremonia). Números con Hanken pesado + `tabular-nums` (no hay Inter/Geist
cargado; ver la card de Órbita Mes como referencia de "número como dato").

## Backend

Servicios en `features/progress/api.ts` (Zod + Supabase) + hooks React Query en
`hooks.ts` (usar `lib/queryKeys.ts`, nunca strings sueltos):

- `ProgressSummary` — el resumen del módulo (compone lo demás).
- `Measurements` — lectura de `body_measurements`.
- `MeasurementComparison` — dos ventanas de tiempo comparadas.
- `PhotoTimeline` — fotos de `photos` ordenadas en el tiempo.

## Database

Tablas (varias YA EXISTEN — verificar antes de crear):

- `body_measurements` ✓ (existe) — peso + medidas.
- `wearable_body_composition` ✓ (existe, gateada) — grasa/músculo/agua/visceral.
- `photos` ✓ (existe) — fotos de progreso.
- `progress_summaries` — **nueva** (si hace falta cachear el resumen). Con RLS
  `auth.uid() = user_id` y CHECK en numéricos (ver `supabase/CLAUDE.md`).

**Antes de cualquier migración**: `rls-auditor`. Toda tabla nueva con RLS.

## Reutiliza

- El patrón por feature del repo: `api.ts` (Zod en el borde) + `hooks.ts` (React
  Query) + `logic.ts` (puro, testeable) + `components/`.
- `RangeChips.tsx`, `HeroStat.tsx`, `ComparativaCard.tsx`, `WeightChart.tsx` ya
  existen — Foundation los ordena bajo el layout nuevo, no los reescribe.

## Definition of Done

Progress queda preparado para crecer sin refactors: layout + navegación entre
Historia/Body, contratos de datos tipados, y los componentes base compilando.
`tsc` + `eslint` limpios; sin regresión visual en lo que ya existe.

## KPIs

N/A (épica de infraestructura).
