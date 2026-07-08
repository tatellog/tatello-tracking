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
2. ✅ (parcial) Los insights determinísticos ya existen; el Prompt Builder
   acepta `insights: string[]` que el cliente pasa desde los detectores. Una
   normalización más rica se puede hacer después.
3. ✅ Tabla `ai_insights` aplicada en prod (RLS auditada) — antes del freeze.
4. ✅ Prompt Builder versionado (`prompt-builder.ts`, `PROMPT_VERSION`) +
   `context-hash.ts` para la clave del caché.
5. ✅ Edge function `stelar-insight` (gpt-4o-mini, lee/escribe caché,
   RLS-scoped). **Falta desplegarla:** `supabase functions deploy
stelar-insight` (bundlea `_shared`; reutiliza el secret OPENAI_API_KEY de
   scan-meal, sin secret nuevo).
6. ✅ (plumbing) Cliente `ai-voice.ts` (hook `useAiVoice` + `fetchAiVoice`)
   gateado por el flag, listo para enchufar a cualquier superficie. Pantalla
   DEV `/dev-ai-insight` prueba el pipeline end-to-end. **Falta** conectar la
   voz a una superficie de producción real (Órbita Mes/Semana/Progreso) — es
   un cambio contenido, pendiente de decidir cuál encender primero.

## Cómo probar (con el flag en true)

1. Desplegar: `supabase functions deploy stelar-insight`.
2. App (Expo Go sirve — es solo un fetch) → Ajustes → `✦ DEV · probar voz de
IA` → elegir periodo. Requiere `is_dev` + datos reales en el periodo.
3. La 2ª llamada al mismo periodo debe volver del caché (`cached: true`), sin
   re-llamar a la IA — validando la regla del `context_hash`.
