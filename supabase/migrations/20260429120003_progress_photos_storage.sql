-- =====================================================================
-- Sprint 2.6 — progress-photos storage bucket policies
--
-- Body photos are intimate. The bucket is private (no public listing)
-- and every read/write is gated on the path's first folder matching
-- auth.uid()::text. The wizard always uploads to
--   {user_id}/{timestamp}_{angle}.jpg
-- so storage.foldername(name)[1] resolves to the owning uid.
--
-- We create the bucket idempotently here so a fresh `supabase db reset`
-- gets it without an extra dashboard step. Remote dashboards already
-- created via the UI will treat the insert as a no-op thanks to the
-- on conflict guard.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'progress-photos',
  'progress-photos',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Drop-and-recreate so policy updates land cleanly on re-run.
drop policy if exists "progress_photos_owner_select" on storage.objects;
drop policy if exists "progress_photos_owner_insert" on storage.objects;
drop policy if exists "progress_photos_owner_delete" on storage.objects;

create policy "progress_photos_owner_select"
  on storage.objects for select
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "progress_photos_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "progress_photos_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
