-- =====================================================================
-- 2026-09-28 — Fotos de comidas y avatares: lectura SOLO de la dueña
--
-- Auditoría de privacidad (dueña): las políticas "*_public_read" dejaban que
-- CUALQUIERA (incluido anon) leyera y LISTARA los objetos de meal-photos y
-- avatars vía la API de Storage — es decir, enumerar las fotos de comida de
-- todas las usuarias. Esta migración las reemplaza por lectura de la dueña
-- (la carpeta raíz del objeto es su user_id, igual que insert/update/delete).
--
-- NO rompe la app en producción: la URL pública (/object/public/…) de un
-- bucket público no pasa por estas políticas. El cierre del bucket
-- (public = false) va en un paso SEPARADO, cuando el build que usa enlaces
-- firmados ya esté en manos de las usuarias (ver docs/privacy-hardening.md).
--
-- Revertir:
--   drop policy if exists "meal_photos_owner_read" on storage.objects;
--   drop policy if exists "avatars_owner_read" on storage.objects;
--   create policy "meal_photos_public_read" on storage.objects for select
--     using (bucket_id = 'meal-photos');
--   create policy "avatars_public_read" on storage.objects for select
--     using (bucket_id = 'avatars');
-- =====================================================================

drop policy if exists "meal_photos_public_read" on storage.objects;
drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "meal_photos_owner_read" on storage.objects;
drop policy if exists "avatars_owner_read" on storage.objects;

create policy "meal_photos_owner_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
