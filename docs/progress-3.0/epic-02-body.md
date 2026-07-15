# Epic 02 · Body

**Status:** Draft · **Priority:** P1 · **Depende de:** Epic 00 (y complementa 01)

---

## Pregunta

> **¿Cómo cambió mi cuerpo?**

## Objetivo

Mostrar la **evolución corporal** como **evidencia visual**. No tablas: el cuerpo
que cambia. La fotografía y el número cuentan la historia.

## Incluye

- **Hero**: Peso → Cambio → Última medición → Nº de mediciones.
- **Timeline**: comparación temporal; al mover el tiempo, **las fotografías
  cambian**.
- **Comparador**: seleccionar dos fechas → comparar.
- **Cards** de composición: Peso · Grasa · Músculo · Agua · Visceral · IMC ·
  Edad metabólica · TMB.
- **Fotos**: frente · espalda · perfil izquierdo · perfil derecho.

## No incluye

**IA. No.** Body es 100% determinístico.

---

## Frontend

- Hero: reusar `HeroStat.tsx` (peso suavizado — media móvil, no el pesaje crudo;
  misma disciplina que `TuHistoria` ya aplica).
- Timeline + comparador: `BeforeAfterSlider.tsx` (las fotos cambian al mover el
  slider) + `RangeChips.tsx`.
- Cards de composición: `MetricCard` (de Epic 00) por métrica.
- `WeightChart.tsx` para la curva de peso.

Números como dato (tabular-nums). El peso se muestra **suavizado** (media de ~10
días) para que un día hinchado/liviano no sea el titular.

## Backend · Measurement + Body Comparison Engine

- Lectura de `body_measurements` (peso, medidas) y `wearable_body_composition`
  (grasa/músculo/agua/visceral/IMC/edad metabólica/TMB — ingesta ya existe,
  gateada por `WEARABLE_BODY_COMPOSITION_ENABLED`).
- `logic.ts`: `smoothedWeightAt()` (ya existe el patrón en `TuHistoria`),
  `compareMeasurements(dateA, dateB)`, `bodyCompositionSeries()`.
- Fotos: `photos` (4 ángulos), emparejadas por fecha para el comparador.

## Database

Todo YA EXISTE:

- `body_measurements` ✓ · `wearable_body_composition` ✓ · `photos` ✓.

**No crear tablas** salvo que Body necesite un ángulo/campo nuevo — en ese caso,
migración con RLS + CHECK numérico (`weight_kg`, `body_fat_pct`, etc. ya tienen
rangos en `supabase/CLAUDE.md`) + `rls-auditor`.

## Reutiliza

- La ingesta de composición corporal de Apple Health (`features/wearables/`) —
  Body solo la **muestra**; encenderla es flip de `WEARABLE_BODY_COMPOSITION_ENABLED`.
- `BeforeAfterSlider` / `BeforeAfterPhotos` ya construidos.

## Guardarraíles

- Rangos generosos en CHECKs: atrapan basura, **no juzgan cuerpos**.
- Sin edad metabólica/TMB presentadas como veredicto de salud — son evidencia de
  cambio, no diagnóstico.
- Un retroceso (subió grasa) se muestra como hecho, sin culpa. El porqué es
  Órbita.

## Definition of Done

Body muestra Hero + timeline con fotos que cambian + comparador de dos fechas +
las cards de composición (las disponibles según ingesta). `logic.ts` con tests
de comparación. `tsc`/`eslint` limpios.

## KPIs

Nº de comparaciones · fotos abiertas · tiempo en Body.
