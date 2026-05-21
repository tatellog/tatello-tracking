-- =====================================================================
-- 2026-05-20 — acquisition source + notification window
--
-- Two onboarding additions:
--
--   acquisition_source  — "how did you hear about us". Free marketing
--                         data, very low friction (one tap). Lets
--                         the team measure which channel converts so
--                         growth budget is steerable instead of blind.
--                         NULL = the user skipped or onboarded
--                         before this column existed; the analytics
--                         layer coalesces NULL to 'unknown'.
--
--   notification_window — the user's preferred time-of-day for Stelar
--                         to talk to them. Asked BEFORE the iOS native
--                         permission prompt so the prompt lands with
--                         consent already mentally given (the warmup
--                         pattern). 'not_yet' is a real value, not a
--                         null marker — it means "asked + declined";
--                         the future re-ask logic uses that.
-- =====================================================================

alter table public.profiles
  add column if not exists acquisition_source text
    check (
      acquisition_source is null or acquisition_source in (
        'instagram',
        'tiktok',
        'app_store',
        'friends_family',
        'influencer',
        'other'
      )
    );

alter table public.profiles
  add column if not exists notification_window text
    check (
      notification_window is null or notification_window in (
        'morning',
        'midday',
        'evening',
        'not_yet'
      )
    );
