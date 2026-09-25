# ADR 0002 · Convergencia de `month-built` — diferida, con guardrail

> **ADDENDUM (23 jul 2026) · CONVERGENCIA EJECUTADA.** Las dos condiciones
> de desbloqueo se cumplieron en V-10: (1) `consistency.ts` convergió a
> `_shared/intelligence/` (re-export en `features/patterns/`); (2) la dueña
> decidió **delimitar, no unificar** — `month-built.ts` = evidencia del mes
> · `month.ts` = narrativa dimensional · `month-patterns.ts` = hábitos de
> cadencia (delimitación documentada en la cabecera de cada módulo).
> `month-built.ts` vive ahora en `_shared/intelligence/` con re-export fino
> en `features/orbit/` (cero cambio a runtime; suite completa de 1082 tests
> en verde). El guardrail de exports sigue vigente sin cambios.

**Estado:** Aceptado (jul 2026, aprobado por la dueña) · **Epic:** 01 · F6 · T6.1
**Supersede:** nada · **Relacionado:** ADR 0001 (punto 5 y 6),
`docs/epics/epic-01-intelligence-engine.md`, `CLAUDE.md` (§ motor de patrones)

## Contexto

CLAUDE.md marca `features/orbit/month-built.ts` como el motor de "mes"
solo-cliente **divergente** que debe converger a `supabase/functions/_shared/
intelligence/` (donde se enchufa la IA server-side de Fase B). F6 preguntó:
¿convergemos ahora?

El análisis de dependencias (F6 · T6.1) encontró:

- `month-built.ts` (~1800 líneas) es **100% lógica pura** (todas las anclas
  temporales entran como parámetros) → técnicamente movible. `DailySignals`,
  `./deficit`, `./water`, `./workout-type` ya convergen sin fricción.
- **Bloqueo de alcance:** converger `month-built` obliga a converger primero
  `features/patterns/consistency.ts` (3 detectores puros —
  `detectProteinConsistency/Sleep/Training`— que aún NO existen en `_shared`).
  Ese archivo es de **otra épica** (patterns); moverlo choca con la regla
  "no cambiar componentes de otra épica" del protocolo de ingeniería.
- **Divergencia preexistente:** `_shared/intelligence/` ya tiene DOS motores de
  "mes" con implementación distinta — `month-patterns.ts` (cadencia de entreno +
  forma semanal, tipo `Patron`) y `month.ts` (narrativa/satélites/voz). Mover
  `month-built` encima **sin decidir si se unifican** dejaría TRES motores del
  mes en `_shared` → la deuda técnica que la Definition of Done prohíbe.
- **Riesgo/valor:** el patrón de convergencia es dejar un re-export fino
  (`export * from '…/_shared/…'`), así que el cambio es **cero a runtime**. Mover
  1800 líneas + arrastrar otra épica + multiplicar motores es relocación de
  código, no convergencia real.

## Decisión

**Diferir la convergencia física de `month-built.ts`.** En su lugar, F6 entrega:

1. **Guardrail que congela la superficie** (`features/orbit/__tests__/
month-built-guardrail.test.ts`): un test que falla si se agrega o quita una
   función exportada de `month-built`. Hace cumplir mecánicamente la regla "un
   detector NUEVO nace en `_shared/intelligence/`, no aquí". Actualizar la lista
   congelada exige una decisión consciente (p. ej. al converger de verdad).

2. **Este ADR** deja registrada la deuda de convergencia y sus dos condiciones de
   desbloqueo (abajo), para que no se pierda ni se ejecute a ciegas.

3. **`conversation_cache` / `ai_insights`:** ya resuelto en ADR 0001 punto 6 —
   se mantiene `ai_insights` (sin cambio de schema); NO se crea
   `conversation_cache`. F6 lo confirma cerrado, sin código nuevo.

## Condiciones para desbloquear la convergencia (trabajo futuro)

La convergencia de `month-built` se retoma cuando se cumplan AMBAS:

1. **La épica patterns converge `consistency.ts` a `_shared/intelligence/`**
   (los 3 detectores puros), destrabando `monthConsistency` /
   `detectMonthPatterns` / `monthReveals`.
2. **Se decide el destino de los 3 motores del mes** (`month-built` vs
   `month-patterns.ts` vs `month.ts`): unificar en uno, o delimitar
   responsabilidades explícitas para que coexistan sin solaparse.

Mientras tanto, `month-built.ts` sigue siendo la fuente solo-cliente de Órbita
Mes (calendario, presencia, patrones) y Progreso (`SynthesisCard`).

## Consecuencias

**Positivas:** respeta "una épica a la vez" (no toca patterns), no crea motores
duplicados, no arriesga la app en vivo con un move de 1800 líneas de valor-runtime
nulo. La regla anti-detector-nuevo queda **ejecutable** (antes era solo un
comentario en CLAUDE.md).

**Negativas / costo:** la divergencia sigue viva — `month-built` no comparte
código con el server, así que la IA de Fase B no puede reusar sus detectores hasta
la convergencia. La deuda queda **explícita y guardada**, no silenciada.

## Alternativas consideradas

- **Mover todo ahora (mirror + re-export).** Rechazada: arrastra `consistency.ts`
  (otra épica) y deja 3 motores del mes en `_shared` = deuda nueva.
- **Convergencia parcial** (mover solo lo que no depende de consistency).
  Rechazada: parte un archivo cohesivo de 1800 líneas en dos → deuda de
  fragmentación peor que la divergencia actual.
