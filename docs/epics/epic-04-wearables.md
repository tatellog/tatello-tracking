# Epic 04 · Wearables / Health Integrations (R4)

**Estado:** Fase 1 CONSTRUIDA (Apple Health) · **PRD:** Release 4 · **Depende de:** nada (alimenta R1)

## Objetivo

Integrar Apple Health, Health Connect, Garmin, Fitbit, Oura, Samsung Health.
Alimentan el **Facts Engine**; no lo reemplazan.

## Arquitectura

```
Wearable → HealthKit / Health Connect → Stelar → Supabase → Facts Engine
```

## Datos

Pasos, sueño, frecuencia cardiaca, HRV, entrenos, peso, calorías activas, VO2,
cadencia, estrés.

## Regla dura

**Nunca depender del wearable.** Todo opcional. Si no existe, Stelar sigue
funcionando (degradación grácil).

## Sync

Background · manual · automático.

## IA

No usa IA. Solo alimenta los motores.

## Estado actual / decisiones previas (memoria)

Spec en `docs/wearables-integration-spec.md`. Decisiones de dueña (jul 2026):

- Multiring de Hoy = 3 aros concéntricos (proteína / calorías / quema); el de
  quema nace lleno al entrenar sin meta.
- **Nunca eat-back ni TDEE.** Pasos ingest-only.
- Apple Health device-side + Garmin cloud-side como primer alcance.

## Criterios de éxito

- [x] Apple Health ingiriendo hacia `daily_signals`/facts (workouts/sueño/pasos;
      `workout_kcal_avg` alimenta el Facts Engine). Health Connect (Android) = Fase 2.
- [~] Sync manual ✓ + foreground ✓; **background real** pendiente.
- [x] La app funciona idéntica sin ningún wearable conectado (COALESCE, "manual
      gana", degradación grácil).

## Estado real (jul 2026 · corrige el "Planeado" anterior)

**Fase 1 CONSTRUIDA** (Apple Health): `features/wearables/` (healthkit/logic/api/
hooks), 3 tablas crudas `wearable_*` con RLS, merge a `daily_signals`, onboarding
paso 11b + Ajustes→Conexiones, plugin en app.json (solo lectura, sin Active
Energy). Ver memoria `wearables-plan-decisions`.

## Tasks

**Hecho (composición · desbloquea R3-Resumen, gated):**

- **T-R4.1** tabla `wearable_body_composition` + RLS (en prod).
- **T-R4.2/3/4** ingesta % grasa / masa magra / IMC desde Apple Health
  (`readBodyComposition` + `bodyCompositionToRows` puro + upsert + cableado en
  `syncAppleHealth`), detrás de `WEARABLE_BODY_COMPOSITION_ENABLED` (OFF).

**Diferido / bloqueado:**

- UI de Resumen (R3) que muestre la composición + ampliar
  `NSHealthShareUsageDescription` (app.json) al encender el flag.
- Android Health Connect (Fase 2, gateada en demanda Android).
- Sync background real; heart rate / HRV / VO2.
- Garmin directo: BLOQUEADO por Garmin (programa suspendido); cobertura por rebote
  vía Apple Health/Health Connect.
