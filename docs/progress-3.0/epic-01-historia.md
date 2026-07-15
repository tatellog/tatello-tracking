# Epic 01 · Historia

**Status:** Draft · **Priority:** P1 · **Depende de:** Epic 00

---

## Pregunta

> **¿Cómo cambiaron mis hábitos?**

## Objetivo

Mostrar la **evolución** del usuario en el tiempo. No solo métricas: una
**historia**. La constancia se siente, no se cuenta con reproche.

## Incluye

- **Hero**: comparación **últimos 30 días vs 30 anteriores**.
- **Cards** de evolución de hábito:
  - Entrenos · Proteína · Déficit · Registro (constancia) · Peso.
- **Timeline**: comparación de fotografías + comparador + slider temporal.
- **Ciclo**: mantener lo que ya existe (no rediseñar aquí).
- **CTA**: "Ver mi cuerpo" → lleva a Epic 02 (Body).

## No incluye

**IA. No.** Historia es 100% determinística (comparación de periodos).

---

## Frontend

- Reusar `TuHistoria.tsx` (hoy es el hero de transformación antes/ahora) como
  punto de partida del Hero — ampliarlo a la comparación 30v30 de hábitos.
- `ComparativaCard.tsx` para las cards de cada hábito (entrenos, proteína,
  déficit, registro, peso).
- `BeforeAfterSlider.tsx` / `BeforeAfterPhotos.tsx` para el comparador de fotos.
- `RangeChips.tsx` para el slider temporal.
- El CTA "Ver mi cuerpo" navega al segmento Body (Epic 02).

Cada card muestra el número **como dato** (Hanken pesado + tabular-nums), la
dirección del cambio (↑/↓ sin color de culpa), y una lectura corta en voz del
coach. Sin countdown, sin "te falta X".

## Backend · Comparison Engine

Lógica pura en `features/progress/logic.ts` (testeable, sin side effects):

- `comparePeriods(signals, { window: 30 })` → agrega los dos bloques de 30 días.
- `compareMetrics()` → por hábito (entrenos, proteína, déficit, registro, peso),
  devuelve `{ current, previous, delta, direction }`.
- `PhotoTimeline()` → fotos de `photos` ordenadas para el comparador.

Datos: leer de `daily_signals` (agregados por día) para hábitos, `body_measurements`
para peso, `photos` para el timeline. Nada nuevo en DB salvo que se cachee.

## Reutiliza

- La ventana rodante y los agregados por día de Órbita (`daily_signals`, la misma
  fuente que `useSignalsHistory`).
- El patrón "número como dato + lectura corta" de la card de Órbita Mes
  (`MonthDiscovery.tsx`) como referencia visual.

## Guardarraíles

- El peso es **una card más** de evidencia, nunca el titular dominante ni una
  meta comparativa.
- Un hábito que bajó se muestra como hecho ("entrenaste menos que el mes
  pasado"), nunca como reproche. Sin "fallaste".
- Historia **no** dice por qué cambió (eso es Órbita). Si el usuario quiere el
  porqué, el puente es el CTA a Órbita (llega en Epic 06).

## Definition of Done

El tab Historia muestra el Hero 30v30 + las 5 cards de hábito + el comparador de
fotos, todo determinístico y manifiesto-safe. `logic.ts` con tests de
`comparePeriods`/`compareMetrics`. `tsc`/`eslint` limpios.

## KPIs

Tiempo en Historia · CTR del CTA a Body · nº de comparaciones abiertas.
