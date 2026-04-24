import { z } from 'zod'

import { supabase } from '@/lib/supabase'

/*
 * BriefContext is validated at the supabase-js boundary because the
 * RPC returns jsonb (opaque Json on the client). A zod schema
 * replaces the old `as unknown as BriefContext` cast with a real
 * runtime parse: schema drift on the server surfaces as a thrown
 * ZodError in the failing query instead of quietly producing
 * undefined fields that crash inside a component.
 *
 * The schema is the source of truth for the type — `BriefContext`
 * is inferred from it, so editing the schema and the type stay in
 * lock-step.
 */

const IsoDateSchema = z.string()

const MoodValueSchema = z.enum(['good', 'neutral', 'struggle'])

const BodyMeasurementSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  measured_at: z.string(),
  weight_kg: z.number().nullable(),
  waist_cm: z.number().nullable(),
  chest_cm: z.number().nullable(),
  hip_cm: z.number().nullable(),
  thigh_cm: z.number().nullable(),
  arm_cm: z.number().nullable(),
  created_at: z.string(),
})

const MoodCheckinSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  value: MoodValueSchema,
  checked_at: z.string(),
  checkin_date: IsoDateSchema,
  created_at: z.string(),
})

const StreakCellSchema = z.object({
  date: IsoDateSchema,
  completed: z.boolean(),
})

const MacroTargetsSchema = z.object({
  user_id: z.string(),
  protein_g: z.number().int(),
  calories: z.number().int(),
  updated_at: z.string(),
})

const TodayMacrosSchema = z.object({
  protein_g: z.coerce.number(),
  calories: z.coerce.number(),
})

export const BriefContextSchema = z.object({
  date: IsoDateSchema,
  day_of_week: z.string(),
  streak_days: z.number().int(),
  today_workout_completed: z.boolean(),
  // ISO timestamp of today's workout insert — null when unmarked.
  // Powers the 'Día sellado · HH:mm' timestamp on the completed bar.
  today_workout_at: z.string().nullable(),
  latest_measurement: BodyMeasurementSchema.nullable(),
  measurement_30d_ago: BodyMeasurementSchema.nullable(),
  grid_28_days: z.array(StreakCellSchema).length(28),
  latest_mood: MoodCheckinSchema.nullable(),
  targets: MacroTargetsSchema.nullable(),
  today_macros: TodayMacrosSchema,
  meal_count_today: z.number().int(),
})

export type BriefContext = z.infer<typeof BriefContextSchema>
export type StreakCell = z.infer<typeof StreakCellSchema>
export type MacroTargetsRow = z.infer<typeof MacroTargetsSchema>
export type TodayMacros = z.infer<typeof TodayMacrosSchema>
export type MoodValue = z.infer<typeof MoodValueSchema>

/*
 * Fetch the authenticated user's brief context.
 *
 * p_date is optional — omit for "today in user tz" (server default).
 * p_user_id is omitted on purpose: the RPC defaults it to auth.uid()
 * and rejects any caller-supplied value that doesn't match, so
 * passing it client-side buys nothing and risks silent mismatches.
 */
export async function fetchBriefContext(date?: string): Promise<BriefContext> {
  const { data, error } = await supabase.rpc('get_brief_context', {
    p_date: date,
  })
  if (error) throw error
  return BriefContextSchema.parse(data)
}
