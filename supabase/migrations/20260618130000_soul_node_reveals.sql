-- =====================================================================
-- 2026-06-18 — soul_node_reveals: progresión del Alma Celeste (por signo)
--
-- Append-only: una fila por (usuario, signo, nodo) la PRIMERA vez que un
-- nodo se revela. Los revelados son PERMANENTES (manifiesto: lo revelado
-- nunca se esconde) → sin policy de update/delete; el borrado de cuenta
-- cascada por la FK. El motor (features/celestial-soul/logic.ts) DERIVA
-- todo el progreso de este conjunto de ids revelados.
--
-- `node_id` / `source` son los ids string ESTABLES de config.ts (un arte y
-- node-map por signo). `config_version` permite reconciliar cambios de
-- node-map sin retroceder progreso (un id que ya no exista se ignora).
--
-- Deshacer: drop table public.soul_node_reveals;
-- =====================================================================

create table if not exists public.soul_node_reveals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  sign            text not null,
  node_id         text not null,
  source          text not null,
  config_version  int  not null default 1 check (config_version >= 1),
  revealed_at     timestamptz not null default now()
);

-- Un nodo se revela UNA vez por usuario y signo. El índice único hace que el
-- upsert del cliente (insert ... on conflict do nothing) caiga natural.
create unique index if not exists soul_node_reveals_unique
  on public.soul_node_reveals (user_id, sign, node_id);
create index if not exists soul_node_reveals_user_sign_idx
  on public.soul_node_reveals (user_id, sign);

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.soul_node_reveals enable row level security;

create policy "users read own soul reveals" on public.soul_node_reveals
  for select using (auth.uid() = user_id);
create policy "users insert own soul reveals" on public.soul_node_reveals
  for insert with check (auth.uid() = user_id);
-- Sin update/delete por diseño: lo revelado del Alma Celeste es permanente
-- (manifiesto). El borrado de cuenta lo cubre el ON DELETE CASCADE de la FK.

-- Privilegios explícitos (menor privilegio, coherente con append-only): solo
-- SELECT + INSERT para usuarios autenticados; nunca UPDATE/DELETE.
grant select, insert on public.soul_node_reveals to authenticated;
