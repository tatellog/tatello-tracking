-- Progress 3.0 · F0 — mediciones/check-ins de composición corporal MANUALES.
-- docs/progress-3.0/ (Epic 02 ampliada por decisión de la dueña jul 2026): el
-- registro que dejó su coach (tipo InBody: composición completa + zonas
-- segmentales) debe poder capturarse A MANO con fecha retroactiva, porque los
-- wearables quizá no den todas las métricas. Manual = fuente de primera clase.
--
-- Complementa (NO reemplaza) a `wearable_body_composition` (ingesta automática,
-- subset de métricas): la lectura del cliente fusiona ambas por día (manual
-- gana). Una fila por (usuaria, día, fuente) → upsert idempotente al editar.
--
-- `metabolic_age` se GUARDA (es el registro histórico de la dueña) pero la UI
-- no lo muestra por default (decisión producto: duele más de lo que informa).
-- Naming técnico-descriptivo, sin terminología clínica (supabase/CLAUDE.md).
-- Rangos generosos: atrapan basura, no juzgan cuerpos.
--
-- Revertir:
--   drop trigger if exists set_body_checkins_updated_at on public.body_checkins;
--   drop table if exists public.body_checkins;

create table if not exists public.body_checkins (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- 'manual' = lo capturó ella · 'coach' = viene del registro de su coach.
  source       text not null default 'manual' check (source in ('manual', 'coach')),
  -- Día de la medición (editable → backfill del histórico del coach).
  measured_on  date not null,

  -- Básicos
  weight_kg    numeric check (weight_kg is null or (weight_kg > 20 and weight_kg < 400)),
  bmi          numeric check (bmi is null or (bmi >= 5 and bmi <= 100)),
  -- TMB (tasa metabólica basal), kcal/día.
  bmr_kcal     numeric check (bmr_kcal is null or (bmr_kcal >= 500 and bmr_kcal <= 6000)),
  water_pct    numeric check (water_pct is null or (water_pct >= 0 and water_pct <= 100)),
  bone_mass_kg numeric check (bone_mass_kg is null or (bone_mass_kg >= 0 and bone_mass_kg <= 20)),
  -- Guardada por completitud del registro; la UI NO la muestra por default.
  metabolic_age numeric check (metabolic_age is null or (metabolic_age >= 10 and metabolic_age <= 120)),
  -- Índice de grasa visceral (escala de báscula, adimensional).
  visceral_fat_index numeric check (visceral_fat_index is null or (visceral_fat_index >= 0 and visceral_fat_index <= 60)),

  -- Músculo (kg) · total + zonas
  muscle_kg           numeric check (muscle_kg is null or (muscle_kg >= 0 and muscle_kg <= 100)),
  muscle_arm_right_kg numeric check (muscle_arm_right_kg is null or (muscle_arm_right_kg >= 0 and muscle_arm_right_kg <= 20)),
  muscle_arm_left_kg  numeric check (muscle_arm_left_kg is null or (muscle_arm_left_kg >= 0 and muscle_arm_left_kg <= 20)),
  muscle_trunk_kg     numeric check (muscle_trunk_kg is null or (muscle_trunk_kg >= 0 and muscle_trunk_kg <= 60)),
  muscle_leg_right_kg numeric check (muscle_leg_right_kg is null or (muscle_leg_right_kg >= 0 and muscle_leg_right_kg <= 30)),
  muscle_leg_left_kg  numeric check (muscle_leg_left_kg is null or (muscle_leg_left_kg >= 0 and muscle_leg_left_kg <= 30)),

  -- Grasa (%) · total + zonas
  body_fat_pct      numeric check (body_fat_pct is null or (body_fat_pct >= 0 and body_fat_pct <= 100)),
  fat_arm_right_pct numeric check (fat_arm_right_pct is null or (fat_arm_right_pct >= 0 and fat_arm_right_pct <= 100)),
  fat_arm_left_pct  numeric check (fat_arm_left_pct is null or (fat_arm_left_pct >= 0 and fat_arm_left_pct <= 100)),
  fat_trunk_pct     numeric check (fat_trunk_pct is null or (fat_trunk_pct >= 0 and fat_trunk_pct <= 100)),
  fat_leg_right_pct numeric check (fat_leg_right_pct is null or (fat_leg_right_pct >= 0 and fat_leg_right_pct <= 100)),
  fat_leg_left_pct  numeric check (fat_leg_left_pct is null or (fat_leg_left_pct >= 0 and fat_leg_left_pct <= 100)),

  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Al menos un valor (CUALQUIER métrica, incl. zonas: un check-in solo-zonas
  -- también es señal · fix de rls-auditor): una fila vacía no aporta.
  constraint body_checkins_has_value check (
    coalesce(weight_kg, bmi, bmr_kcal, water_pct, bone_mass_kg, metabolic_age,
      visceral_fat_index, muscle_kg, muscle_arm_right_kg, muscle_arm_left_kg,
      muscle_trunk_kg, muscle_leg_right_kg, muscle_leg_left_kg, body_fat_pct,
      fat_arm_right_pct, fat_arm_left_pct, fat_trunk_pct, fat_leg_right_pct,
      fat_leg_left_pct) is not null
  ),
  -- Un check-in por (usuaria, día, fuente) → editar = upsert, sin duplicados.
  unique (user_id, measured_on, source)
);

alter table public.body_checkins enable row level security;

create policy "body_checkins_select_own" on public.body_checkins
  for select using (auth.uid() = user_id);
create policy "body_checkins_insert_own" on public.body_checkins
  for insert with check (auth.uid() = user_id);
create policy "body_checkins_update_own" on public.body_checkins
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "body_checkins_delete_own" on public.body_checkins
  for delete using (auth.uid() = user_id);

-- updated_at vía la función propia del repo (NO existe la extensión moddatetime;
-- public.set_updated_at() se creó en 20260701213508_daily_notes.sql).
drop trigger if exists set_body_checkins_updated_at on public.body_checkins;
create trigger set_body_checkins_updated_at
  before update on public.body_checkins
  for each row execute function public.set_updated_at();

-- Lectura típica: el historial de una usuaria ordenado por fecha.
create index if not exists body_checkins_user_measured_idx
  on public.body_checkins (user_id, measured_on desc);
