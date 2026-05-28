import * as ImageManipulator from 'expo-image-manipulator'
import { z } from 'zod'

import { NewMeasurementInputSchema } from '@/features/progress/api'
import { requireUserId, supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

export type Profile = Database['public']['Tables']['profiles']['Row']

// NOTE: the legacy `Goal` enum (recomposition, lose_fat, gain_muscle,
// maintain) is no longer collected by the wizard. Its replacement is
// `monthly_focus` (see below), which calcMacros uses to derive the
// kcal / protein deltas internally. The `profiles.goal` column still
// exists but is read-only / never written by the app.

export const BIOLOGICAL_SEX_VALUES = ['female', 'male'] as const
export type BiologicalSex = (typeof BIOLOGICAL_SEX_VALUES)[number]

/** Trained per week. Bucketed coarsely because users can't tell you
 *  "I train 2.4 times a week" — they pick a band. The engine refines
 *  the real count from workout logs once they exist. */
export const TRAINING_FREQUENCY_VALUES = ['none', 'low', 'mid', 'high'] as const
export type TrainingFrequency = (typeof TRAINING_FREQUENCY_VALUES)[number]

/** How the user's cycle works (if it works). Drives whether Mes
 *  surfaces cycle-bound content at all — for `skip`, `pregnant`,
 *  `postmenopause` the cycle dimension hides; the rest of Stelar
 *  still reads the body. */
export const CYCLE_SITUATION_VALUES = [
  'menstruates',
  'contraception',
  'pregnant',
  'postmenopause',
  'irregular',
  'skip',
] as const
export type CycleSituation = (typeof CYCLE_SITUATION_VALUES)[number]

/** One chip choice for "what you're growing this month". Biases the
 *  Voz toward this outcome; never restricts what gets logged. Includes
 *  `weight` and `energy` (outcome buckets) alongside the dimensional
 *  ones — added 2026-05-20 because forcing "lose weight" into "food"
 *  muddied the Voz's filter. `patterns` replaces `self_knowledge`
 *  (clearer name for what Stelar actually does). */
export const MONTHLY_FOCUS_VALUES = [
  'weight',
  'energy',
  'sleep',
  'food',
  'cycle',
  'patterns',
  'mind',
  'other',
] as const
export type MonthlyFocus = (typeof MONTHLY_FOCUS_VALUES)[number]

/** Marketing attribution — "how did you hear about us". Optional;
 *  the user can skip the screen entirely (column stays null). */
export const ACQUISITION_SOURCE_VALUES = [
  'instagram',
  'tiktok',
  'app_store',
  'friends_family',
  'influencer',
  'other',
] as const
export type AcquisitionSource = (typeof ACQUISITION_SOURCE_VALUES)[number]

/** Preferred time of day for Stelar to send notifications. The
 *  warmup pattern: pick this BEFORE we fire the iOS native permission
 *  prompt, so the prompt lands with consent already mentally given.
 *  `not_yet` means "asked + declined"; the future re-ask logic uses
 *  that flag to decide when to surface a soft nudge later. */
export const NOTIFICATION_WINDOW_VALUES = ['morning', 'midday', 'evening', 'not_yet'] as const
export type NotificationWindow = (typeof NOTIFICATION_WINDOW_VALUES)[number]

/*
 * Update schema mirrors the DB CHECK constraints so the wizard fails
 * fast with a useful message instead of letting Postgres throw a
 * generic CHECK-violation. Every field is optional — each step only
 * patches its own column. zod's .optional() keeps the input shape
 * exactly aligned with the supabase update payload.
 */
export const ProfileUpdateSchema = z
  .object({
    display_name: z.string().trim().min(1, 'Mínimo 1 carácter').max(40, 'Máximo 40 caracteres'),
    date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
    biological_sex: z.enum(BIOLOGICAL_SEX_VALUES),
    height_cm: z.number().int().min(51, 'Mínimo 51 cm').max(249, 'Máximo 249 cm'),
    onboarding_completed_at: z.string(),
    avatar_path: z.string(),
    // IANA zone name. The DB trg_validate_profile_timezone trigger is
    // the real validator (it rejects bad names); the client just guards
    // against an empty/oversized string before the round-trip.
    timezone: z.string().min(1, 'Requerido').max(64, 'Máximo 64 caracteres'),
    // ── Órbita onboarding fields (2026-05-20) ───────────────────────
    cycle_length_days: z.number().int().min(21, 'Mínimo 21').max(45, 'Máximo 45'),
    typical_sleep_hours: z.number().min(3, 'Mínimo 3h').max(14, 'Máximo 14h'),
    training_frequency: z.enum(TRAINING_FREQUENCY_VALUES),
    cycle_situation: z.enum(CYCLE_SITUATION_VALUES),
    monthly_focus: z.enum(MONTHLY_FOCUS_VALUES),
    acquisition_source: z.enum(ACQUISITION_SOURCE_VALUES),
    notification_window: z.enum(NOTIFICATION_WINDOW_VALUES),
  })
  .partial()

export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>

/*
 * profiles.id is auth.users.id (1:1, created by the handle_new_user
 * trigger). RLS already filters by auth.uid() = id so we don't add
 * an explicit eq filter — the response is the caller's own row.
 */
export async function getProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').maybeSingle()
  if (error) throw error
  return data
}

export async function updateProfile(input: ProfileUpdate): Promise<Profile> {
  const userId = await requireUserId()
  const parsed = ProfileUpdateSchema.parse(input)
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...parsed, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

const AVATAR_PX = 512

/* The public URL for an avatar storage path. The `avatars` bucket is
 * public, so this is a stable link with no signing. */
export function avatarUrl(path: string): string {
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

/*
 * Resize → JPEG-compress → upload to the `avatars` bucket → point the
 * profile row at the new file. The picker hands us an already-square
 * crop, so a flat 512×512 resize won't distort. The path is
 * timestamped ({userId}/{epochMillis}.jpg) so each new avatar gets a
 * fresh URL — no CDN cache to bust. The leading {userId} folder is the
 * RLS gate (see 20260516120003_profile_avatar.sql).
 */
export async function uploadAvatar(uri: string): Promise<Profile> {
  const userId = await requireUserId()
  const processed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: AVATAR_PX, height: AVATAR_PX } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
  )
  // React Native's fetch().blob() uploads 0 bytes to Supabase Storage —
  // an ArrayBuffer carries the real bytes (the documented RN pattern).
  const bytes = await fetch(processed.uri).then((r) => r.arrayBuffer())
  if (bytes.byteLength === 0) throw new Error('La imagen quedó vacía al procesarla.')
  const path = `${userId}/${Date.now()}.jpg`

  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(path, bytes, { contentType: 'image/jpeg', cacheControl: '3600' })
  if (uploadErr) throw uploadErr

  return updateProfile({ avatar_path: path })
}

/*
 * Inserts the user's first weight reading into body_measurements (not
 * profiles). Keeping weight in the time-series table from day 1 means
 * the progress chart starts with a real datapoint rather than a
 * synthetic baseline imported later.
 */
export async function insertInitialWeight(weightKg: number): Promise<void> {
  const userId = await requireUserId()
  // Validate through the same schema as the in-app "add measurement"
  // flow so an out-of-range weight (0, negative, > 500) is caught at
  // the boundary with the Spanish error users see elsewhere instead
  // of falling through to a Postgres CHECK violation.
  const { weight_kg } = NewMeasurementInputSchema.parse({ weight_kg: weightKg })
  const { error } = await supabase.from('body_measurements').insert({
    user_id: userId,
    weight_kg,
    measured_at: new Date().toISOString(),
  })
  if (error) throw error
}

/*
 * Records the user's last reported period start during onboarding. The
 * raw event lives in cycle_events (one source of truth — the cycle
 * sprint will later derive phase / length / predictions from this
 * table). We insert ON CONFLICT DO NOTHING so a user who returns to
 * the screen and re-confirms the same date doesn't get a duplicate
 * (the unique index on user_id+event_type+event_date guards it). The
 * date is the LOCAL calendar date the user picked — cycle_events.
 * event_date is a `date`, not a timestamp.
 */
export async function recordLastPeriodStart(eventDateIso: string): Promise<void> {
  const userId = await requireUserId()
  const { error } = await supabase.from('cycle_events').upsert(
    {
      user_id: userId,
      event_type: 'period_start',
      event_date: eventDateIso,
    },
    { onConflict: 'user_id,event_type,event_date', ignoreDuplicates: true },
  )
  if (error) throw error
}
