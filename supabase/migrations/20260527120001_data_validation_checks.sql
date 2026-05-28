-- =====================================================================
-- 2026-05-27 — defence-in-depth CHECK constraints
--
-- The Zod schemas at the API boundary already reject impossible values
-- (weight 0, negative macros, etc) but a buggy client or direct REST
-- call could still write garbage. The CHECK constraints below are the
-- hard backstop. Bounds are deliberately wide — they catch the
-- "extra zero typo" and "negative number" bugs, not normal user
-- variance.
--
-- Existing checks already in the schema:
--   - macro_targets.protein_g  > 0 and < 1000   (20260424181345)
--   - macro_targets.calories   > 0 and < 10000  (20260424181345)
--   - meals.protein_g          >= 0             (20260424181345)
--   - meals.calories           >= 0             (20260424181345)
--   - body_measurements composition fields (bmi, bmr, water_pct,
--     bone_mass_kg, metabolic_age, visceral_fat, muscle_mass_kg,
--     body_fat_pct) already constrained in 20260504120001.
-- =====================================================================

-- body_measurements: weight + circumferences. All columns are
-- nullable, so each check passes when the value is null (legacy rows
-- with only weight stay valid). The bound only applies when a real
-- number is being written.
alter table public.body_measurements
  add constraint body_measurements_weight_kg_realistic
    check (weight_kg is null or (weight_kg > 0 and weight_kg < 500)),
  add constraint body_measurements_waist_cm_realistic
    check (waist_cm is null or (waist_cm > 0 and waist_cm < 300)),
  add constraint body_measurements_chest_cm_realistic
    check (chest_cm is null or (chest_cm > 0 and chest_cm < 300)),
  add constraint body_measurements_hip_cm_realistic
    check (hip_cm is null or (hip_cm > 0 and hip_cm < 300)),
  add constraint body_measurements_thigh_cm_realistic
    check (thigh_cm is null or (thigh_cm > 0 and thigh_cm < 200)),
  add constraint body_measurements_arm_cm_realistic
    check (arm_cm is null or (arm_cm > 0 and arm_cm < 200));

-- meals: per-meal upper bounds. The existing `>= 0` checks stay; we
-- only add the upper limit. A single meal with > 500 g protein or
-- > 5000 kcal is almost certainly an extra-zero typo, not a real log.
alter table public.meals
  add constraint meals_protein_g_realistic check (protein_g < 500),
  add constraint meals_calories_realistic  check (calories < 5000);
