-- Revertir: drop table if exists public.seen_combos;
-- Los patrones (combinaciones de hábitos) que ya se le mostraron a la usuaria
-- (dueña 1 oct 2026). Antes vivían solo en el teléfono (AsyncStorage): un
-- teléfono nuevo (o Android junto al iPhone) no recordaba el patrón y la
-- histéresis de winningCombo no lo mantenía vivo, así que cada dispositivo
-- mostraba algo distinto. Aquí es una fila por patrón visto, por usuaria.
-- Mismo patrón de RLS que el resto: cada quien solo ve y escribe lo suyo.

create table if not exists public.seen_combos (
  user_id uuid not null references auth.users (id) on delete cascade,
  combo_key text not null check (char_length(combo_key) between 1 and 64),
  first_seen_at timestamptz not null default now(),
  primary key (user_id, combo_key)
);

alter table public.seen_combos enable row level security;

drop policy if exists "seen_combos_select_own" on public.seen_combos;
create policy "seen_combos_select_own" on public.seen_combos
  for select using (auth.uid() = user_id);

drop policy if exists "seen_combos_insert_own" on public.seen_combos;
create policy "seen_combos_insert_own" on public.seen_combos
  for insert with check (auth.uid() = user_id);

drop policy if exists "seen_combos_delete_own" on public.seen_combos;
create policy "seen_combos_delete_own" on public.seen_combos
  for delete using (auth.uid() = user_id);
