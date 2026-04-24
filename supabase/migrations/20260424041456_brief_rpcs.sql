-- =====================================================================
-- Sprint 1 — brief RPCs
--
-- Two security-definer functions that read across a user's rows without
-- re-implementing the aggregation on the client. The caller's identity
-- is enforced: p_user_id defaults to auth.uid() and, if supplied, must
-- match it. Anon role cannot execute; only authenticated users can.
-- =====================================================================

-- Walk back day-by-day from today, counting consecutive workouts.
-- Today's missing workout does NOT break the streak (the user may still
-- train later in the day); any earlier missing day does.
create or replace function public.get_current_streak(
  p_user_id  uuid default auth.uid(),
  p_timezone text default 'America/Mexico_City'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_streak      int     := 0;
  v_today       date    := (now() at time zone p_timezone)::date;
  v_check_date  date    := v_today;
  v_found       boolean;
begin
  if p_user_id is null then
    raise exception 'get_current_streak: not authenticated';
  end if;
  if p_user_id <> auth.uid() then
    raise exception 'get_current_streak: p_user_id must match auth.uid()';
  end if;

  loop
    select exists (
      select 1 from public.workouts
      where user_id = p_user_id and workout_date = v_check_date
    ) into v_found;

    if v_found then
      v_streak     := v_streak + 1;
      v_check_date := v_check_date - interval '1 day';
    else
      -- Today with no workout yet: don't break the streak, but step back
      -- to check yesterday. Any other missing day is a break.
      if v_check_date = v_today then
        v_check_date := v_check_date - interval '1 day';
      else
        exit;
      end if;
    end if;

    -- Safety guard against runaway loops on bad data.
    if v_streak > 3650 then exit; end if;
  end loop;

  return v_streak;
end;
$$;

-- Bundle everything the morning brief needs in one JSON payload:
-- streak, whether today is already logged, latest measurement, and the
-- measurement nearest to ~30 days ago (for the progress delta).
create or replace function public.get_brief_context(
  p_user_id uuid default auth.uid(),
  p_date    date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today                date  := coalesce(p_date, (now() at time zone 'America/Mexico_City')::date);
  v_streak               int;
  v_today_workout        boolean;
  v_latest_measurement   jsonb;
  v_measurement_30d_ago  jsonb;
begin
  if p_user_id is null then
    raise exception 'get_brief_context: not authenticated';
  end if;
  if p_user_id <> auth.uid() then
    raise exception 'get_brief_context: p_user_id must match auth.uid()';
  end if;

  v_streak := public.get_current_streak(p_user_id);

  select exists (
    select 1 from public.workouts
    where user_id = p_user_id and workout_date = v_today
  ) into v_today_workout;

  select to_jsonb(m) into v_latest_measurement
  from public.body_measurements m
  where user_id = p_user_id
  order by measured_at desc
  limit 1;

  -- "About 30 days ago" — we want the latest measurement taken at least
  -- 25 days before today, so the comparison window is roughly a month.
  select to_jsonb(m) into v_measurement_30d_ago
  from public.body_measurements m
  where user_id = p_user_id
    and measured_at <= (v_today - interval '25 days')
  order by measured_at desc
  limit 1;

  return jsonb_build_object(
    'date',                    v_today,
    'streak_days',             v_streak,
    'today_workout_completed', v_today_workout,
    'latest_measurement',      v_latest_measurement,
    'measurement_30d_ago',     v_measurement_30d_ago
  );
end;
$$;

-- Lock both RPCs: anon cannot call; only a logged-in user can, and by
-- the p_user_id check above they can only query their own data.
revoke execute on function public.get_current_streak(uuid, text) from public;
grant  execute on function public.get_current_streak(uuid, text) to authenticated;

revoke execute on function public.get_brief_context(uuid, date) from public;
grant  execute on function public.get_brief_context(uuid, date) to authenticated;
