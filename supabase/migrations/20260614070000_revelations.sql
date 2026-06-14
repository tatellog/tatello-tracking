-- =====================================================================
-- 2026-06-14 — revelations: el registro unificado de Revelaciones
--
-- Las Revelaciones son momentos ESCASOS y narrativos (pocas/mes), a
-- diferencia de las recompensas (frecuentes). Tres tiers escriben aquí
-- — esta tabla es a la vez (a) el log de Historia ("toda revelación
-- genera una entrada") y (b) la fuente de de-dup / rate-limit:
--
--   tier='transformation'  kind in ('25','50','75','100')
--     · hito del reveal del emblema. UNA vez por umbral por usuaria
--       (índice único parcial). "Nunca se repite, nunca retrocede."
--   tier='return'          kind='return'
--     · regreso tras 3+ días fuera. Una por episodio de regreso.
--   tier='pattern'         kind in ('night_eating','protein_consistent',
--                                   'training_consistent','sleep_consistent')
--     · comportamiento repetido (14 días). Máx 1 cada 7 días (cualquier
--       patrón) — el rate-limit se consulta sobre shown_at.
--
-- Prioridad de selección (en el orquestador, no en la DB):
--   Regreso > Patrón > Nada.
--
-- Spec: docs/revelations-system-spec.md. Voz: nunca juzga / corrige /
-- recomienda / diagnostica — solo evidencia. Ver PRODUCT_MANIFESTO.md y
-- features/patterns/CLAUDE.md (los conteos en patrones están aprobados
-- por el owner, Decisión #1 de la spec, con marco de evidencia neutral).
-- =====================================================================

create table public.revelations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  tier         text not null check (tier in ('transformation', 'return', 'pattern')),
  -- Conjunto cerrado por ahora: un CHECK explícito evita que un typo en el
  -- orquestador ('protein_consistnet') rompa silenciosamente la de-dup. Si
  -- se agrega un patrón nuevo, extender este check en una migración.
  kind         text not null check (kind in (
    '25', '50', '75', '100',          -- transformation
    'return',                         -- return
    'night_eating', 'protein_consistent', 'training_consistent', 'sleep_consistent'  -- pattern
  )),
  -- La línea de Historia ("Leo despertó."). Texto ya resuelto en voz del
  -- coach al momento de revelar — Historia no recalcula copy.
  title        text not null,
  shown_at     timestamptz not null default now(),
  dismissed_at timestamptz,
  -- Datos de evidencia (p. ej. {"count": 5, "window_days": 7}) — alimentan
  -- el copy con conteos sin recomputar la detección.
  metadata     jsonb not null default '{}'::jsonb
);

-- Un umbral de transformación se revela UNA sola vez por usuaria. El índice
-- único parcial lo garantiza en la DB. El cliente inserta con
-- `on conflict do nothing` (NO `on conflict on constraint` — un índice
-- parcial no es referenciable por nombre de constraint): un duplicado es
-- no-op silencioso.
create unique index revelations_transformation_once_idx
  on public.revelations (user_id, kind)
  where tier = 'transformation';

-- Historia (timeline por usuaria) + lecturas recientes.
create index revelations_user_shown_idx
  on public.revelations (user_id, shown_at desc);

-- Rate-limit de patrones (1/7d) + de-dup de regreso: consultas por tier.
create index revelations_user_tier_shown_idx
  on public.revelations (user_id, tier, shown_at desc);

alter table public.revelations enable row level security;

create policy "users read own revelations" on public.revelations
  for select using (auth.uid() = user_id);

create policy "users insert own revelations" on public.revelations
  for insert with check (auth.uid() = user_id);

-- WITH CHECK además de USING: sin él, una usuaria podría reasignar su fila a
-- otra (UPDATE SET user_id = '<otro>') porque RLS no validaría el post-write.
create policy "users update own revelations" on public.revelations
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Sin policy DELETE por diseño: las revelaciones son Historia inmutable.
-- El borrado de cuenta se cubre por on delete cascade en la FK a auth.users.
-- Si algún día hay que eliminar una fila puntual, vía service role en una
-- edge function con validación explícita — nunca desde el cliente.
