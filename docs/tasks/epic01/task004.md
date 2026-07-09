# Task 004 · Findings Engine · migrar detectores

**Epic:** 01 · **Estado:** Parcial · **Depende de:** task003

## Descripción

Migrar los detectores ya escritos en `features/orbit/findings.ts` al Findings
Engine formal (server + cliente compartido), sin perder cobertura.

## Detectores existentes a migrar

- `detectDeficitSummary` (verdicto: déficit sostenido).
- `detectWeekdayDietBreak` (obstáculo: día que rompe la dieta) + contrast.
- `detectTrainingDeficit` (palanca: gym como ancla) + contrast.
- `detectWaterDeficit` (palanca: agua↔déficit).
- `detectWeekdayCalories` (día con más kcal).
- `crossHypothesis` (hipótesis de cruce).

## Nuevos a considerar (del feedback de usuaria)

- Registro que cae el finde (necesita rango de fechas para días 100% ausentes).
- Día que se salta el gym (por día de semana o condición).

## Criterios de aceptación

- [ ] Paridad con los tests actuales de `findings.test.ts` (jest).
- [ ] Hecho, no culpa: copy revisado por `manifesto-reviewer` + `voice-and-copy`.
- [ ] Sin regresión en Órbita Mes (reporte + chat siguen igual).

## Notas

Es refactor: un solo cambio, no mezclar con features nuevas.
