-- Revertir: alter table public.wearable_workouts drop column if exists activity;
-- La actividad concreta del entreno (dueña 2 oct 2026: "quiero saber qué tipo
-- de ejercicio hice"). workout_type sigue siendo el vocabulario canónico del
-- motor (fuerza / cardio / caminata / otro); `activity` es el nombre que se
-- muestra ("Bici", "Correr", "Yoga"…). Nullable: filas viejas no lo tienen.
-- Sin cambios de RLS (las policies de la tabla siguen igual).

alter table public.wearable_workouts
  add column if not exists activity text
  check (activity is null or char_length(activity) between 1 and 40);
