# Task 003 · Findings Engine · tabla `findings` + formalizar

**Epic:** 01 · **Estado:** Parcial · **Depende de:** task001, task002

## Descripción

Formalizar el Findings Engine: detecta RELACIONES desde `facts` por reglas (sin
IA) y las persiste en `findings`. Hoy los detectores viven en
`features/orbit/findings.ts` (client-side); esta task define el contrato y la tabla.

## Alcance

- Migración `findings` (id, user_id, period, `id_slug`, category, `is_obstacle`,
  confidence, subject, support, contrast, north_link, hypothesis, evidence_dates,
  chart jsonb, created_at) + RLS.
- Tipo `Finding` como fuente única (hoy en `findings.ts`).

## Criterios de aceptación

- [ ] RLS + policy `auth.uid() = user_id`.
- [ ] El tipo `Finding` cubre: verdict, obstacle ("dónde se te va"), lever, con contrast.
- [ ] Sin IA en la detección.

## Notas

Alinear con la enmienda `pattern-palanca-apple-realism` (números como evidencia
en Hanken, nunca en el italic del coach ni como acusación).
