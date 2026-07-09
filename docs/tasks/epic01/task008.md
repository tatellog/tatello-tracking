# Task 008 · monthly_reports · ensamblado + persistencia

**Epic:** 01 · **Estado:** Todo · **Depende de:** task004, task005, task006, task007

## Descripción

Ensamblar el reporte mensual (verdicto + obstáculos + palancas + historias +
hipótesis + cierre) y persistirlo en `monthly_reports`. Es lo que Órbita Mes (R2)
consume y lo que R6 archiva como memoria.

## Alcance

- Tabla `monthly_reports` (id, user_id, month, `payload` jsonb, `findings_hash`,
  created_at) + RLS.
- Función `buildMonthlyReport(facts, findings, stories, hypothesis): Report`.
- `findings_hash` para invalidación/caché (ya usado por el chat).

## Criterios de aceptación

- [ ] Un reporte por (usuario, mes), idempotente.
- [ ] El reporte determinístico de Órbita Mes se alimenta de aquí (no de `findings.ts` client-side).
- [ ] Peso FUERA del veredicto (se ancla en déficit sostenido).

## Notas

Criterio de éxito del PRD: "generar reporte mensual". Es la salida integradora de R1.
