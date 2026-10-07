-- Recuperada del historial remoto (supabase_migrations.schema_migrations, 7 oct
-- 2026): se aplicó en producción sin archivo en el repo. La tabla se borró
-- después en 20260925080913_drop_soul_node_reveals.

-- soul_node_reveals: progresión del Alma Celeste (por signo). Append-only;
-- los revelados son PERMANENTES (manifiesto). El motor deriva todo el progreso
-- del set de ids revelados.
create table if not exists public.soul_node_reveals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  sign            text not null,
  node_id         text not null,
  source          text not null,
  config_version  int  not null default 1 check (config_version >= 1),
  revealed_at     timestamptz not null default now()
);

create unique index if not exists soul_node_reveals_unique
  on public.soul_node_reveals (user_id, sign, node_id);
create index if not exists soul_node_reveals_user_sign_idx
  on public.soul_node_reveals (user_id, sign);

alter table public.soul_node_reveals enable row level security;

create policy "users read own soul reveals" on public.soul_node_reveals
  for select using (auth.uid() = user_id);
create policy "users insert own soul reveals" on public.soul_node_reveals
  for insert with check (auth.uid() = user_id);

grant select, insert on public.soul_node_reveals to authenticated;
