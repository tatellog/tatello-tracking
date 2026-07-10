-- =====================================================================
-- 2026-07-09 — wearables · composición corporal (Epic 04 · R4 · T-R4.1)
-- (desbloquea R3-Resumen · docs/wearables-integration-spec.md)
--
-- Apple Health recibe % grasa, masa magra e IMC por REBOTE de básculas
-- inteligentes (InBody / Tanita / Withings escriben a HealthKit). Stelar
-- los ingiere aquí (upsert idempotente), NUNCA en body_measurements (tabla
-- manual). El futuro Resumen (R3) decidirá cómo mostrarlos/mergearlos.
--
-- Formato WIDE por día (misma identidad que wearable_steps): una fila por
-- (usuaria, fuente, día local). HealthKit guarda cada cantidad como sample
-- separado; el cliente los agrupa por día y toma el más reciente por tipo.
-- Visceral / % agua NO son tipos estándar de HealthKit (son propios de la
-- báscula) → fuera de alcance, no se inventan.
--
-- La ingesta va GATEADA en el cliente (flag WEARABLE_BODY_COMPOSITION_ENABLED,
-- hoy OFF): esta tabla puede existir vacía sin efecto alguno.
--
-- Revertir:
--   drop table if exists public.wearable_body_composition;
-- =====================================================================

create table if not exists public.wearable_body_composition (
  id                 uuid not null default gen_random_uuid() primary key,
  user_id            uuid not null references auth.users(id) on delete cascade,
  source             text not null check (source in ('apple_health', 'garmin')),
  -- Día LOCAL de la medición (lo computa el cliente con profiles.timezone).
  day_date           date not null,
  -- Rangos generosos: atrapan basura, no juzgan cuerpos (supabase/CLAUDE.md).
  body_fat_pct       numeric check (body_fat_pct is null or (body_fat_pct >= 0 and body_fat_pct <= 100)),
  lean_body_mass_kg  numeric check (lean_body_mass_kg is null or (lean_body_mass_kg >= 0 and lean_body_mass_kg <= 300)),
  bmi                numeric check (bmi is null or (bmi >= 0 and bmi <= 100)),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Al menos un valor: una fila vacía no aporta señal.
  constraint wearable_body_composition_has_value
    check (body_fat_pct is not null or lean_body_mass_kg is not null or bmi is not null),
  -- Un snapshot por (usuaria, fuente, día). Upsert idempotente al re-sincronizar.
  unique (user_id, source, day_date)
);

alter table public.wearable_body_composition enable row level security;

drop policy if exists "wearable_body_composition_select_own" on public.wearable_body_composition;
create policy "wearable_body_composition_select_own" on public.wearable_body_composition
  for select using (auth.uid() = user_id);
drop policy if exists "wearable_body_composition_insert_own" on public.wearable_body_composition;
create policy "wearable_body_composition_insert_own" on public.wearable_body_composition
  for insert with check (auth.uid() = user_id);
drop policy if exists "wearable_body_composition_update_own" on public.wearable_body_composition;
create policy "wearable_body_composition_update_own" on public.wearable_body_composition
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "wearable_body_composition_delete_own" on public.wearable_body_composition;
create policy "wearable_body_composition_delete_own" on public.wearable_body_composition
  for delete using (auth.uid() = user_id);

-- Lectura: la serie de composición de una usuaria en el tiempo (para el Resumen).
create index if not exists wearable_body_composition_user_day_idx
  on public.wearable_body_composition (user_id, day_date);

drop trigger if exists set_wearable_body_composition_updated_at on public.wearable_body_composition;
create trigger set_wearable_body_composition_updated_at
  before update on public.wearable_body_composition
  for each row execute function public.set_updated_at();
