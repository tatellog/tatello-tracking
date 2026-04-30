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
