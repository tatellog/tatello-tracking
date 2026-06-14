-- =====================================================================
-- 2026-06-14 — RLS hardening: WITH CHECK en las policies de UPDATE
--
-- Hueco detectado en auditoría: una policy `for update using (auth.uid()
-- = user_id)` valida la fila ANTES del cambio pero NO la imagen posterior.
-- Sin `with check`, una usuaria autenticada puede:
--     update <tabla> set user_id = '<otra-usuaria>' where <su fila>
-- y PLANTAR una fila en los datos de otra usuaria (envenenando su motor de
-- patrones / órbita). `with check (auth.uid() = user_id)` valida el
-- post-write y cierra el hueco. (La tabla `revelations` ya nació correcta;
-- es el molde — ver 20260614070000_revelations.sql.)
--
-- DROP + CREATE (idempotente) en vez de ALTER POLICY: ALTER no tiene
-- IF EXISTS y abortaría a medias si un nombre difiriera, dejando estado
-- inconsistente (rls-auditor). Esto recrea cada policy conservando el USING
-- y agregando el WITH CHECK; `drop ... if exists` lo hace re-ejecutable.
-- =====================================================================

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "users update own workouts" on public.workouts;
create policy "users update own workouts" on public.workouts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users update own measurements" on public.body_measurements;
create policy "users update own measurements" on public.body_measurements
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users update own photos" on public.photos;
create policy "users update own photos" on public.photos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users update own briefs" on public.briefs;
create policy "users update own briefs" on public.briefs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users update own moods" on public.mood_checkins;
create policy "users update own moods" on public.mood_checkins
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users update own targets" on public.macro_targets;
create policy "users update own targets" on public.macro_targets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users update own meals" on public.meals;
create policy "users update own meals" on public.meals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users update own water" on public.water_intake;
create policy "users update own water" on public.water_intake
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users update own wellbeing" on public.wellbeing_checkins;
create policy "users update own wellbeing" on public.wellbeing_checkins
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users update own sleep" on public.sleep_logs;
create policy "users update own sleep" on public.sleep_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users update own cycle" on public.cycle_events;
create policy "users update own cycle" on public.cycle_events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users update own detected_patterns" on public.detected_patterns;
create policy "users update own detected_patterns" on public.detected_patterns
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
