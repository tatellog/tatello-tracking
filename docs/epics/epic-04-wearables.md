# Epic 04 · Wearables / Health Integrations (R4)

**Estado:** Planeado · **PRD:** Release 4 · **Depende de:** nada (alimenta R1)

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

- [ ] Apple Health + Health Connect ingiriendo hacia `daily_signals`/facts
- [ ] Sync background + manual
- [ ] La app funciona idéntica sin ningún wearable conectado

## Tasks

Pendiente de desglosar en `../tasks/epic04/`.
