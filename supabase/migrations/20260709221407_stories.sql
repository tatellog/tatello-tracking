-- Epic 01 · F3 · T3.1 — tabla `stories` (Story Engine).
--
-- Persiste las HISTORIAS: pares de hallazgos de dimensiones distintas que
-- coincidieron en días reales (co-ocurrencia, NUNCA causa · manifiesto). Las
-- computa buildStories (_shared/intelligence/stories.ts) y las escribe el writer
-- (plegado en compute-findings, con el JWT de la usuaria, RLS-scoped).
--
-- El contrato `Story` es simple (id, findingIds, chain, score) → todo en
-- columnas, sin payload jsonb.
--
-- ADITIVA y no destructiva (DB en producción). Revertir:
--   drop table if exists public.stories cascade;

create table if not exists public.stories (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  period_type   text not null check (period_type in ('day', 'week', 'month', 'last30')),
  period_start  date not null,
  period_end    date not null check (period_end >= period_start),
  -- Slug estable de la historia ('water-deficit+training-deficit').
  story_id      text not null check (char_length(story_id) between 1 and 140),
  -- Los hallazgos que la componen (slugs). Un par en v1; se deja hasta 6.
  -- coalesce(...,0): un array vacío da array_length NULL → el CHECK lo aceptaría;
  -- así se rechaza de verdad (integridad del par).
  finding_ids   text[] not null check (coalesce(array_length(finding_ids, 1), 0) between 2 and 6),
  -- La secuencia de nodos en humano (subjects + "tu déficit"). Labels, no causa.
  chain         text[] not null check (coalesce(array_length(chain, 1), 0) between 2 and 6),
  score         integer not null check (score >= 0 and score <= 100000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Idempotencia del writer: una historia por (usuaria, periodo, slug) → upsert.
  unique (user_id, period_type, period_start, period_end, story_id)
);

-- RLS: cada quien ve/escribe SOLO sus filas. (drop-if-exists → replay-safe.)
alter table public.stories enable row level security;

drop policy if exists "stories_select_own" on public.stories;
create policy "stories_select_own"
  on public.stories for select
  using (auth.uid() = user_id);

drop policy if exists "stories_insert_own" on public.stories;
create policy "stories_insert_own"
  on public.stories for insert
  with check (auth.uid() = user_id);

drop policy if exists "stories_update_own" on public.stories;
create policy "stories_update_own"
  on public.stories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "stories_delete_own" on public.stories;
create policy "stories_delete_own"
  on public.stories for delete
  using (auth.uid() = user_id);

-- updated_at automático. Usa public.set_updated_at() (daily_notes migration);
-- este proyecto NO tiene la extensión moddatetime.
drop trigger if exists set_stories_updated_at on public.stories;
create trigger set_stories_updated_at
  before update on public.stories
  for each row execute function public.set_updated_at ();

-- Camino de lectura: las historias de una usuaria en un periodo.
create index if not exists stories_user_period_idx
  on public.stories (user_id, period_type, period_start, period_end);

-- Longitudinal (R6): "¿esta historia se repitió en meses anteriores?".
create index if not exists stories_user_story_idx
  on public.stories (user_id, story_id);
