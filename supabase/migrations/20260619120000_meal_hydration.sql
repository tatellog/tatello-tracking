-- =====================================================================
-- 2026-06-19 — meal_hydration: hidratación derivada de comidas
--
-- Cuando una usuaria registra una comida con bebidas/alimentos líquidos
-- (jugo verde, licuado, café, agua…), Stelar detecta esos líquidos y
-- SUGIERE su aporte a la hidratación del día. La usuaria acepta, edita o
-- rechaza — nunca se suma en silencio. Esta tabla guarda esa decisión.
--
-- El agua TOTAL de un día = water_intake.glasses (agua directa) +
-- suma de meal_hydration.glasses con status='accepted' ese día. El agua
-- directa (stepper de QuickLog) sigue viviendo en water_intake intacta;
-- esta tabla solo añade el aporte de comidas, sin doble conteo.
--
-- Por qué tabla aparte y no una columna en water_intake:
--   · guardar el ORIGEN (qué comida aportó cuánta agua) — desglose
--     "agua directa vs desde comidas".
--   · meal_id con ON DELETE CASCADE → borrar la comida resta su agua
--     automáticamente, sin lógica de app.
--   · unique(meal_id) → editar la comida RECALCULA su misma fila
--     (upsert), nunca duplica.
--
-- updated_at lo setea la app en el upsert (mismo patrón que
-- water_intake) — sin trigger, para no introducir moddatetime que el
-- resto del esquema no usa.
--
-- Reversa: drop table public.meal_hydration;
-- =====================================================================

create table if not exists public.meal_hydration (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  -- Una comida = una decisión de hidratación (unique abajo). Borrar la
  -- comida arrastra su aporte de agua (cascade).
  meal_id        uuid not null references public.meals(id) on delete cascade,
  -- Día local al que cuenta el agua (= meals.meal_date). Se guarda para
  -- que el desglose por día sea index-cheap sin un join a meals.
  intake_date    date not null,
  -- Vasos (250 ml c/u) que esta comida aporta. Fraccionario porque un
  -- líquido puede contar al 75 % o medio vaso (0.25 de resolución). Tope
  -- 8 vasos = 2 L por comida: cubre caldos + licuados grandes y atrapa
  -- basura (una sola comida no aporta 5 L de agua).
  glasses        numeric(4,2) not null default 0 check (glasses >= 0 and glasses <= 8),
  -- 'accepted' = la usuaria sumó este aporte; 'rejected' = lo vio y dijo
  -- "no contar" (se guarda para no volver a preguntar y para análisis).
  status         text not null check (status in ('accepted', 'rejected')),
  -- Los líquidos detectados (nombre, factor, vasos) — auditoría + el
  -- desglose que ve la usuaria. Snapshot, no se recalcula al vuelo.
  detected_items jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (meal_id)
);

-- Desglose del día (suma de aportes aceptados) sin recorrer toda la tabla.
create index if not exists meal_hydration_user_date_idx
  on public.meal_hydration (user_id, intake_date);

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.meal_hydration enable row level security;

create policy "users read own meal hydration" on public.meal_hydration
  for select using (auth.uid() = user_id);
create policy "users insert own meal hydration" on public.meal_hydration
  for insert with check (auth.uid() = user_id);
-- using + with check: la fila debe ser propia ANTES y DESPUÉS del update
-- (no se puede reasignar a otra user_id). Ver 20260614160000.
create policy "users update own meal hydration" on public.meal_hydration
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own meal hydration" on public.meal_hydration
  for delete using (auth.uid() = user_id);
