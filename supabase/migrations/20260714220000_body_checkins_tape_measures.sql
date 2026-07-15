-- Progress 3.0 · Epic 08 (rediseño "Nueva medición", decisión dueña 14 jul
-- 2026) — MEDIDAS CORPORALES de cinta en el check-in: cuello, pecho, cintura,
-- abdomen, caderas y extremidades con lado (der/izq). Viven en body_checkins
-- (una fila por usuaria+día+fuente, editable por fecha) — NO en la vieja
-- body_measurements, que no distingue lados ni tiene cuello/abdomen/
-- pantorrillas y es por-timestamp, no por-sesión.
--
-- Naming técnico-descriptivo sin terminología clínica. Rangos generosos:
-- atrapan basura, no juzgan cuerpos.
--
-- Revertir:
--   alter table public.body_checkins
--     drop column if exists neck_cm,
--     drop column if exists chest_cm,
--     drop column if exists waist_cm,
--     drop column if exists abdomen_cm,
--     drop column if exists hips_cm,
--     drop column if exists arm_right_cm,
--     drop column if exists arm_left_cm,
--     drop column if exists thigh_right_cm,
--     drop column if exists thigh_left_cm,
--     drop column if exists calf_right_cm,
--     drop column if exists calf_left_cm;
--   alter table public.body_checkins drop constraint if exists body_checkins_has_value;
--   alter table public.body_checkins add constraint body_checkins_has_value check (
--     coalesce(weight_kg, bmi, bmr_kcal, water_pct, bone_mass_kg, metabolic_age,
--       visceral_fat_index, muscle_kg, muscle_arm_right_kg, muscle_arm_left_kg,
--       muscle_trunk_kg, muscle_leg_right_kg, muscle_leg_left_kg, body_fat_pct,
--       fat_arm_right_pct, fat_arm_left_pct, fat_trunk_pct, fat_leg_right_pct,
--       fat_leg_left_pct) is not null
--   );

alter table public.body_checkins
  add column if not exists neck_cm        numeric(5,2) check (neck_cm        > 10 and neck_cm        < 100),
  add column if not exists chest_cm       numeric(5,2) check (chest_cm       > 30 and chest_cm       < 250),
  add column if not exists waist_cm       numeric(5,2) check (waist_cm       > 30 and waist_cm       < 250),
  add column if not exists abdomen_cm     numeric(5,2) check (abdomen_cm     > 30 and abdomen_cm     < 250),
  add column if not exists hips_cm        numeric(5,2) check (hips_cm        > 30 and hips_cm        < 250),
  add column if not exists arm_right_cm   numeric(5,2) check (arm_right_cm   > 10 and arm_right_cm   < 100),
  add column if not exists arm_left_cm    numeric(5,2) check (arm_left_cm    > 10 and arm_left_cm    < 100),
  add column if not exists thigh_right_cm numeric(5,2) check (thigh_right_cm > 20 and thigh_right_cm < 150),
  add column if not exists thigh_left_cm  numeric(5,2) check (thigh_left_cm  > 20 and thigh_left_cm  < 150),
  add column if not exists calf_right_cm  numeric(5,2) check (calf_right_cm  > 10 and calf_right_cm  < 100),
  add column if not exists calf_left_cm   numeric(5,2) check (calf_left_cm   > 10 and calf_left_cm   < 100);

-- El CHECK de "al menos un valor" debe reconocer las medidas nuevas: un
-- check-in SOLO de cinta también es una medición válida.
alter table public.body_checkins
  drop constraint if exists body_checkins_has_value;

alter table public.body_checkins
  add constraint body_checkins_has_value check (
    coalesce(weight_kg, bmi, bmr_kcal, water_pct, bone_mass_kg, metabolic_age,
      visceral_fat_index, muscle_kg, muscle_arm_right_kg, muscle_arm_left_kg,
      muscle_trunk_kg, muscle_leg_right_kg, muscle_leg_left_kg, body_fat_pct,
      fat_arm_right_pct, fat_arm_left_pct, fat_trunk_pct, fat_leg_right_pct,
      fat_leg_left_pct, neck_cm, chest_cm, waist_cm, abdomen_cm, hips_cm,
      arm_right_cm, arm_left_cm, thigh_right_cm, thigh_left_cm, calf_right_cm,
      calf_left_cm) is not null
  );
