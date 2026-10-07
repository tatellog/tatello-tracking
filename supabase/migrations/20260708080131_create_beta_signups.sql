-- Recuperada del historial remoto (supabase_migrations.schema_migrations, 7 oct
-- 2026): se aplicó en producción sin archivo en el repo (lista de espera de la
-- landing).
create table if not exists public.beta_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text default 'landing',
  created_at timestamptz not null default now(),
  constraint email_format check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$')
);

alter table public.beta_signups enable row level security;

-- the landing may only INSERT; nobody anonymous can read the list
create policy "anon can join the beta"
  on public.beta_signups
  for insert
  to anon
  with check (true);
