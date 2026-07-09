# Task 001 · Facts Engine · tabla `facts` + RLS

**Epic:** 01 · Intelligence Engine · **Estado:** Todo · **Depende de:** —

## Descripción

Crear la tabla `facts` que persiste los HECHOS agregados por usuario y periodo
(lo que hoy calcula al vuelo `daily_signals`/`_shared/intelligence`). Nunca
interpreta: solo hechos crudos ya agregados.

## Alcance

- Migración `supabase/migrations/*_facts.sql`.
- Columnas: `id`, `user_id`, `period_type` (day/week/month), `period_start`,
  `period_end`, `kind` (deficit_days, avg_protein, avg_water, avg_sleep,
  workouts, avg_mood, weight_change…), `value` (numeric/jsonb), `evidence_count`,
  `created_at`.
- Índice por `(user_id, period_type, period_start, period_end, kind)`.

## Criterios de aceptación

- [ ] `ENABLE ROW LEVEL SECURITY` + policy `auth.uid() = user_id` en la misma migración.
- [ ] CHECK constraints en rangos numéricos donde aplique.
- [ ] FK `user_id → auth.users(id) on delete cascade`.
- [ ] `rls-auditor` sin issues altos antes de aplicar.

## Notas

Naming sin terminología clínica. Una migración atómica. Ver `supabase/CLAUDE.md`.
