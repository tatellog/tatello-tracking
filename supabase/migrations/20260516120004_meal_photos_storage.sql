-- =====================================================================
-- 2026-05-16 — meal photos: the dish photo from the scan-meal flow
--
-- `meals.photo_storage_path` (already on the table) holds the storage
-- path of the meal's photo inside the `meal-photos` bucket; the client
-- derives the public URL from it. The bucket is public — a meal photo
-- is low-sensitivity, like an avatar — so reads need no signed URL;
-- writes stay gated to the owner's {user_id}/ folder.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meal-photos',
  'meal-photos',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Drop-and-recreate so policy updates land cleanly on re-run.
drop policy if exists "meal_photos_public_read"  on storage.objects;
drop policy if exists "meal_photos_owner_insert" on storage.objects;
drop policy if exists "meal_photos_owner_update" on storage.objects;
drop policy if exists "meal_photos_owner_delete" on storage.objects;

create policy "meal_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'meal-photos');

create policy "meal_photos_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "meal_photos_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "meal_photos_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
