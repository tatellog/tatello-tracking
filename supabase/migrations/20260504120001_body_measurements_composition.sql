-- =====================================================================
-- 2026-05-04 — body_measurements: full composition fields
--
-- Until now body_measurements held weight + circumferences only. Real
-- user input comes off body composition scales (InBody / Tanita)
-- which expose BMI, BMR, water%, bone mass, metabolic age, visceral
-- fat, muscle mass, and body fat %. They're all read at the same
-- timestamp from the same scale, so they belong on the same row.
--
-- All columns are nullable: legacy rows just have weight_kg + waist
-- and that's fine. New rows from a scale fill in everything; new
-- rows from a manual entry can fill in just weight.
-- =====================================================================

alter table public.body_measurements
  add column if not exists bmi              numeric(4,1)  check (bmi is null or (bmi > 5 and bmi < 80)),
  add column if not exists bmr              int           check (bmr is null or (bmr > 500 and bmr < 5000)),
  add column if not exists water_pct        numeric(4,1)  check (water_pct is null or (water_pct >= 0 and water_pct <= 100)),
  add column if not exists bone_mass_kg     numeric(4,1)  check (bone_mass_kg is null or (bone_mass_kg > 0 and bone_mass_kg < 20)),
  add column if not exists metabolic_age    int           check (metabolic_age is null or (metabolic_age > 0 and metabolic_age < 120)),
  add column if not exists visceral_fat     numeric(4,1)  check (visceral_fat is null or (visceral_fat >= 0 and visceral_fat < 60)),
  add column if not exists muscle_mass_kg   numeric(5,2)  check (muscle_mass_kg is null or (muscle_mass_kg > 0 and muscle_mass_kg < 200)),
  add column if not exists body_fat_pct     numeric(4,1)  check (body_fat_pct is null or (body_fat_pct >= 0 and body_fat_pct <= 100));
