# Stelar Release 1 · AI Foundation — spec

**Estado:** aprobado por la dueña (jul 2026) · construcción por fases, bajo
flag. **Rama:** `context-engine`. **Objetivo:** base técnica para que Stelar
use IA de forma barata, consistente y escalable — una **capa de explicación**,
no el motor de cálculo.

## Principio rector (ya es la arquitectura de Stelar)

```
datos → daily_signals → Context Engine → Insights Engine → Prompt Builder → IA → AI Cache → UI
```

**La IA NO detecta el patrón. El backend detecta (determinístico). La IA solo
explica.** Esto ya es como está construido Stelar hoy (motor determinístico en
`_shared/intelligence/`); este release agrega la voz encima, no reemplaza el
motor.

Reglas duras del release:

- NO chat libre. NO llamar IA al abrir cada pantalla. NO enviar registros raw.
- La IA se llama SOLO cuando el `context_hash` cambió (si no, sirve el caché).

## Decisiones de la dueña

- **Modelo: OpenAI gpt-4o-mini** (mismo que `scan-meal`, un solo proveedor,
  la `OPENAI_API_KEY` ya existe como secret). NO se implementa Anthropic. El
  Prompt Builder y la edge function se diseñan **agnósticos de proveedor** (el
  modelo vive en una constante + `prompt_version` en el caché) para poder
  cambiar de una línea en el futuro, sin lock-in.
- **Todo bajo un feature flag** (`lib/featureFlags.ts` → `AI_VOICE_ENABLED`).
  Para pruebas, el flag arranca en `true`. La beta puede validar con la voz
  determinística existente si se apaga.

## Inventario: qué ya existe vs qué es nuevo

| Feature                 | Estado    | Detalle                                                                                                                                                             |
| ----------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context Engine          | 🟡→🟢     | Métricas existían dispersas (`month.ts`, `adaptive-tdee.ts`, `month-built.ts`). Este release las consolida en un objeto plano en `_shared/intelligence/context.ts`. |
| Insights Engine         | 🟢 existe | ~10 detectores determinísticos ya construidos (`*-patterns.ts`, `night-pattern.ts`, `features/patterns/`).                                                          |
| Prompt Builder          | 🔴 nuevo  | Solo prompts inline en `scan-meal`.                                                                                                                                 |
| AI Cache                | 🔴 nuevo  | Tabla `ai_insights` (greenfield). Cambio de schema → antes del freeze del 19 jul.                                                                                   |
| Prep Órbita/Progreso IA | 🟢 base   | La estructura `VozParte` ya existe; la IA se enchufa ahí.                                                                                                           |

## Context Engine (paso 1 · construido)

`supabase/functions/_shared/intelligence/context.ts` — puro, corre server +
cliente (re-export en `features/orbit/context.ts`). `buildPeriodContext(...)`
produce un objeto plano y serializable por periodo (día/semana/mes/últimos-30),
con comparación opcional vs periodo anterior. Consume `DailySignals[]` (filas
ya deduplicadas por `mergeDaySignals`), inyecta la regla de déficit (patrón del
repo, ver `workout-type.ts`).

Forma del contexto: `{ period, dateRange, nutrition{avgCalories, avgProtein,
deficitDays, surplusDays, daysLogged}, activity{workoutDays, workoutKcalAvg},
sleep{avgSleepMinutes, daysAbove7h}, body{weightChangeKg, latestWeightKg},
vsPrevious?{...deltas}, patterns:[] }`.

Nota **pasos**: `wearable_steps` es ingest-only y NO está en `daily_signals`
(spec wearables §1), así que `avgSteps` se difiere — el Context Engine no lo
incluye hasta que se decida su superficie.

## Deficit rule centralizada

`isDeficitDay` / `DEFICIT_FLOOR_RATIO` se mueven a
`_shared/intelligence/deficit.ts` (su hogar canónico per CLAUDE.md: el motor es
la fuente de verdad). `features/orbit/deficit.ts` pasa a re-export (todos los
imports existentes siguen funcionando).

## Guardrails (ya codificados en el manifiesto)

La IA NUNCA dice: debes comer · debes entrenar · tienes un problema · esto
causó aquello · diagnóstico médico · consejo psicológico. SÍ puede: "en tus
registros apareció" · "esto coincidió con" · "esto se repitió" · "esto llamó mi
atención" · "podrías observar esto". Mapea 1:1 con el manifiesto y
`features/patterns/CLAUDE.md` (prohíbe contar frecuencia).

## Orden de construcción

1. ✅ Context Engine puro (`context.ts`) + deficit centralizado + tests.
2. Normalizar salida de detectores existentes a una forma "insight" común.
3. Tabla `ai_insights` (`context_hash`/`prompt_version`/`expires_at`/`response`)
   - RLS (rls-auditor, antes del 19 jul).
4. Prompt Builder versionado (agnóstico de proveedor).
5. Edge function `stelar-insight` (clona `scan-meal`, gpt-4o-mini, lee/escribe
   caché).
6. Enchufar a `VozParte`, tras el flag.
