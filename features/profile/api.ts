import * as ImageManipulator from 'expo-image-manipulator'
import { z } from 'zod'

import { requireUserId, supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

export type Profile = Database['public']['Tables']['profiles']['Row']

export const GOAL_VALUES = ['recomposition', 'lose_fat', 'gain_muscle', 'maintain'] as const
export type Goal = (typeof GOAL_VALUES)[number]

export const BIOLOGICAL_SEX_VALUES = ['female', 'male'] as const
export type BiologicalSex = (typeof BIOLOGICAL_SEX_VALUES)[number]

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
    goal: z.enum(GOAL_VALUES),
    onboarding_completed_at: z.string(),
    avatar_path: z.string(),
    // IANA zone name. The DB trg_validate_profile_timezone trigger is
    // the real validator (it rejects bad names); the client just guards
    // against an empty/oversized string before the round-trip.
    timezone: z.string().min(1, 'Requerido').max(64, 'Máximo 64 caracteres'),
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
  const { error } = await supabase.from('body_measurements').insert({
    user_id: userId,
    weight_kg: weightKg,
    measured_at: new Date().toISOString(),
  })
  if (error) throw error
}
