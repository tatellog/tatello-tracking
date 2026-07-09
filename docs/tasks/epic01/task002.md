# Task 002 · Facts Engine · cómputo de agregados

**Epic:** 01 · **Estado:** Todo · **Depende de:** task001

## Descripción

El engine que convierte registros → hechos y los escribe en `facts`. Puro y
determinístico. Reusa la lógica de agregación ya existente en
`_shared/intelligence/` (nutrición, actividad, sueño, cuerpo).

## Alcance

- Función pura `computeFacts(signals, ctx): Fact[]` en `_shared/intelligence/`.
- Job/trigger que la corre por periodo (edge `daily-intelligence` o RPC).
- Idempotente: recalcular el mismo periodo no duplica (upsert por llave única).

## Criterios de aceptación

- [ ] Mismos agregados que hoy produce el Context Engine (tripwire del hash dorado no rompe).
- [ ] Tests jest de `computeFacts` (casos: sin datos, parcial, completo).
- [ ] Nunca interpreta (no hay lógica de "esto significa X").

## Notas

`daily_signals` es por DÍA sin timestamps de hora → hechos por-hora quedan fuera
hasta capturar timestamps.
