-- Health Connect (Android) como fuente de las tablas crudas del reloj
-- (spec wearables §8.1, dueña 1 oct 2026). Solo amplía el CHECK de `source`:
-- sin tablas nuevas, sin tocar RLS (las policies auth.uid() = user_id siguen
-- igual). daily_signals ya toma todas las fuentes, así que los datos de
-- Android entran a la app sin cambios en la vista.

alter table public.wearable_workouts drop constraint if exists wearable_workouts_source_check;
alter table public.wearable_workouts add constraint wearable_workouts_source_check
  check (source in ('apple_health', 'health_connect', 'garmin'));

alter table public.wearable_sleep drop constraint if exists wearable_sleep_source_check;
alter table public.wearable_sleep add constraint wearable_sleep_source_check
  check (source in ('apple_health', 'health_connect', 'garmin'));

alter table public.wearable_steps drop constraint if exists wearable_steps_source_check;
alter table public.wearable_steps add constraint wearable_steps_source_check
  check (source in ('apple_health', 'health_connect', 'garmin'));

alter table public.wearable_water drop constraint if exists wearable_water_source_check;
alter table public.wearable_water add constraint wearable_water_source_check
  check (source in ('apple_health', 'health_connect', 'garmin'));

alter table public.wearable_weight drop constraint if exists wearable_weight_source_check;
alter table public.wearable_weight add constraint wearable_weight_source_check
  check (source in ('apple_health', 'health_connect', 'garmin'));

alter table public.wearable_body_composition drop constraint if exists wearable_body_composition_source_check;
alter table public.wearable_body_composition add constraint wearable_body_composition_source_check
  check (source in ('apple_health', 'health_connect', 'garmin'));
