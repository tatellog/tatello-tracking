-- =====================================================================
-- Sprint 2.6 — extend photos table for the 4-angle wizard
--
-- The Sprint 1 schema modeled photos with three angles
-- ('front', 'side', 'back') and a nullable angle column. The 2.6
-- onboarding wizard captures the body from four angles, distinguishing
-- left and right laterals, and we want every row to carry the angle
-- so queries don't have to NULL-check it. We also start storing
-- width/height/byte_size so reminder-side comparisons can pick a
-- representative image without rehydrating it.
--
-- RLS already enabled in 20260424041455_rls_policies.sql; nothing to
-- change there.
-- =====================================================================

-- Backfill any pre-existing rows so the new constraint can be applied.
-- 'side' is migrated to 'side_right' as a best guess (dev only — the
-- table should be empty in real environments at the time of running).
update public.photos set angle = 'front'      where angle is null;
update public.photos set angle = 'side_right' where angle = 'side';

-- Replace the 3-value check with the 4-angle check.
alter table public.photos drop constraint if exists photos_angle_check;
alter table public.photos
  add constraint photos_angle_check
  check (angle in ('front', 'side_right', 'side_left', 'back'));

-- Now that every row has a value, enforce NOT NULL.
alter table public.photos alter column angle set not null;

-- New metadata columns. All nullable so historical rows aren't broken.
alter table public.photos
  add column if not exists width     int,
  add column if not exists height    int,
  add column if not exists byte_size int;

-- Cheap lookup for "give me the latest photo for angle X". The
-- photos_user_date_idx from Sprint 1 already covers (user_id,
-- taken_at desc) for the gallery walk; this one targets the
-- per-angle reminder query.
create index if not exists photos_user_angle_idx
  on public.photos (user_id, angle, taken_at desc);
