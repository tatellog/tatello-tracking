import * as ImageManipulator from 'expo-image-manipulator'
import { z } from 'zod'

import { requireUserId, supabase } from '@/lib/supabase'
import type { Database, Json } from '@/types/database.types'

type MacroTargetsRow = Database['public']['Tables']['macro_targets']['Row']
export type Meal = Database['public']['Tables']['meals']['Row']

/*
 * Input schemas mirror the DB CHECK constraints so the client
 * fails fast with a useful message instead of letting Postgres
 * throw a generic CHECK-violation. These are re-used by the form
 * resolver (react-hook-form + zod) so the user sees the same
 * rules while typing, not only on submit.
 */

export const MacroTargetsInputSchema = z.object({
  // Realistic adult range (50-300 g protein, 1000-5000 kcal). Stops
  // typo'd values (e.g. extra zero) from landing in the targets row
  // before the Home rings render with broken denominators.
  protein_g: z.number().int('Usa números enteros').min(50, 'Mínimo 50 g').max(300, 'Máximo 300 g'),
  calories: z
    .number()
    .int('Usa números enteros')
    .min(1000, 'Mínimo 1000 cal')
    .max(5000, 'Máximo 5000 cal'),
})

export type MacroTargetsInput = z.infer<typeof MacroTargetsInputSchema>

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export const MealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack'])

export const MealInputSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres'),
  protein_g: z.number().min(0, 'No puede ser negativo').max(500, 'Máximo 500 g'),
  calories: z
    .number()
    .int('Usa números enteros')
    .min(0, 'No puede ser negativo')
    .max(5000, 'Máximo 5000 cal'),
  consumed_at: z
    .date()
    .refine((d) => d.getTime() <= Date.now() + 60_000, 'No puede ser en el futuro')
    .refine((d) => d.getTime() >= Date.now() - SEVEN_DAYS_MS, 'Máximo 7 días atrás'),
  meal_type: MealTypeSchema,
})

export type MealInput = z.infer<typeof MealInputSchema>

/** A meal's ingredient breakdown — persisted in `ai_raw_response`. */
export type StoredIngredient = {
  name: string
  grams: number
  proteinPer100: number
  kcalPer100: number
}

/** createMeal carries the optional photo + ingredients from the scan. */
export type CreateMealInput = MealInput & {
  photo_storage_path?: string | null
  ingredients?: StoredIngredient[]
}

/** updateMeal carries the optional edited ingredient breakdown and a
 *  newly-attached photo. */
export type UpdateMealInput = MealInput & {
  ingredients?: StoredIngredient[]
  photo_storage_path?: string | null
}

/* The ai_raw_response payload that stores a meal's ingredients. */
function ingredientsPayload(ingredients?: StoredIngredient[]): Json {
  if (!ingredients || ingredients.length === 0) return null
  return {
    ingredients: ingredients.map(({ name, grams, proteinPer100, kcalPer100 }) => ({
      name,
      grams,
      proteinPer100,
      kcalPer100,
    })),
  }
}

/* Parse a stored ai_raw_response payload into ingredients. */
function parseIngredients(raw: Json | null): StoredIngredient[] | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const list = (raw as { ingredients?: unknown }).ingredients
  if (!Array.isArray(list)) return null
  const parsed: StoredIngredient[] = []
  for (const item of list) {
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      if (
        typeof o.name === 'string' &&
        typeof o.grams === 'number' &&
        typeof o.proteinPer100 === 'number' &&
        typeof o.kcalPer100 === 'number'
      ) {
        parsed.push({
          name: o.name,
          grams: o.grams,
          proteinPer100: o.proteinPer100,
          kcalPer100: o.kcalPer100,
        })
      }
    }
  }
  return parsed.length > 0 ? parsed : null
}

/** A meal's stored ingredient breakdown, or null when it has none. */
export function mealIngredients(meal: Meal): StoredIngredient[] | null {
  return parseIngredients(meal.ai_raw_response)
}

/* ─── macro_targets ──────────────────────────────────────────────── */

export async function getMacroTargets(): Promise<MacroTargetsRow | null> {
  const { data, error } = await supabase.from('macro_targets').select('*').maybeSingle()
  if (error) throw error
  return data
}

export async function upsertMacroTargets(input: MacroTargetsInput): Promise<MacroTargetsRow> {
  const userId = await requireUserId()
  const parsed = MacroTargetsInputSchema.parse(input)
  const { data, error } = await supabase
    .from('macro_targets')
    .upsert({
      user_id: userId,
      protein_g: parsed.protein_g,
      calories: parsed.calories,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/* ─── meals ──────────────────────────────────────────────────────── */

export async function getMealsForDate(mealDate: string): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('meal_date', mealDate)
    .order('consumed_at', { ascending: true })
  if (error) throw error
  return data
}

export async function getMealById(id: string): Promise<Meal | null> {
  const { data, error } = await supabase.from('meals').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

/* A frequent meal is a de-duplicated entry from the user's own log,
 * surfaced for one-tap re-adding in the Hoy-tab quick log. The macros
 * come from the user's most recent entry of that name (foods drift;
 * the latest log is the best estimate). */
export type FrequentMeal = {
  /** Id of the most recent meal with this name — the row to open
   *  when the user taps the history entry to edit it. */
  id: string
  name: string
  meal_type: string
  protein_g: number
  calories: number
  /** Storage path of the most recent photo across this name's
   *  occurrences — carried so a re-log keeps the dish photo. */
  photo_storage_path: string | null
  /** Most recent ingredient breakdown for this name — carried so a
   *  re-log keeps the detected ingredients. */
  ingredients: StoredIngredient[] | null
  /** How many times this name appears in the lookback window. */
  freq: number
}

const FREQUENT_LOOKBACK_DAYS = 90

/*
 * Frequent meals — the quick log's "Lo de siempre". Derived purely
 * from the user's own meal history (no food database, no seeding):
 * pull the last 90 days, group by lowercased name, rank by frequency
 * then recency. Aggregation is client-side — at this volume (a few
 * hundred rows at most) it's cheaper than maintaining a Postgres RPC.
 * If the dataset ever outgrows that, this is the seam to move to a
 * server-side `group by`.
 */
export async function getFrequentMeals(limit = 8): Promise<FrequentMeal[]> {
  const userId = await requireUserId()
  const since = new Date(Date.now() - FREQUENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('meals')
    .select(
      'id, name, meal_type, protein_g, calories, consumed_at, photo_storage_path, ai_raw_response',
    )
    .eq('user_id', userId)
    .gte('consumed_at', since)
    .order('consumed_at', { ascending: false })
  if (error) throw error

  type Agg = FrequentMeal & { lastAt: string }
  const groups = new Map<string, Agg>()
  for (const m of data) {
    const key = m.name.trim().toLowerCase()
    const existing = groups.get(key)
    if (existing) {
      existing.freq += 1
      // Keep the most recent photo + ingredients this name ever had.
      // Rows are consumed_at DESC, so only fill still-empty slots.
      if (!existing.photo_storage_path && m.photo_storage_path) {
        existing.photo_storage_path = m.photo_storage_path
      }
      if (!existing.ingredients) {
        existing.ingredients = parseIngredients(m.ai_raw_response)
      }
    } else {
      // First time seen — and because rows are consumed_at DESC, this
      // first occurrence is the most recent, so its id + macros win.
      groups.set(key, {
        id: m.id,
        name: m.name.trim(),
        meal_type: m.meal_type,
        protein_g: Number(m.protein_g),
        calories: m.calories,
        photo_storage_path: m.photo_storage_path,
        ingredients: parseIngredients(m.ai_raw_response),
        freq: 1,
        lastAt: m.consumed_at,
      })
    }
  }

  return [...groups.values()]
    .sort((a, b) => b.freq - a.freq || b.lastAt.localeCompare(a.lastAt))
    .slice(0, limit)
    .map(({ lastAt: _lastAt, ...meal }) => meal)
}

export async function createMeal(input: CreateMealInput): Promise<Meal> {
  const userId = await requireUserId()
  const parsed = MealInputSchema.parse(input)
  const { data, error } = await supabase
    .from('meals')
    .insert({
      user_id: userId,
      name: parsed.name,
      protein_g: parsed.protein_g,
      calories: parsed.calories,
      consumed_at: parsed.consumed_at.toISOString(),
      meal_type: parsed.meal_type,
      source: 'manual',
      photo_storage_path: input.photo_storage_path ?? null,
      ai_raw_response: ingredientsPayload(input.ingredients),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

const MEAL_PHOTO_PX = 720

/** Public URL for a meal photo storage path — the bucket is public. */
export function mealPhotoUrl(path: string): string {
  return supabase.storage.from('meal-photos').getPublicUrl(path).data.publicUrl
}

/*
 * Resize → JPEG-compress → upload the scan photo to the public
 * `meal-photos` bucket; returns the storage path to save on the meal
 * row. The leading {userId} folder is the RLS gate (see the
 * 20260516120004_meal_photos_storage.sql migration).
 */
export async function uploadMealPhoto(uri: string): Promise<string> {
  const userId = await requireUserId()
  const processed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MEAL_PHOTO_PX } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  )
  // React Native's fetch().blob() uploads 0 bytes to Supabase Storage —
  // supabase-js can't read the lazy RN Blob. An ArrayBuffer carries the
  // real bytes; this is the documented React Native upload pattern.
  const bytes = await fetch(processed.uri).then((r) => r.arrayBuffer())
  if (bytes.byteLength === 0) throw new Error('La imagen quedó vacía al procesarla.')
  const path = `${userId}/${Date.now()}.jpg`
  const { error } = await supabase.storage
    .from('meal-photos')
    .upload(path, bytes, { contentType: 'image/jpeg', cacheControl: '3600' })
  if (error) throw error
  return path
}

export async function updateMeal(id: string, input: UpdateMealInput): Promise<Meal> {
  const parsed = MealInputSchema.parse(input)
  const patch: Database['public']['Tables']['meals']['Update'] = {
    name: parsed.name,
    protein_g: parsed.protein_g,
    calories: parsed.calories,
    consumed_at: parsed.consumed_at.toISOString(),
    meal_type: parsed.meal_type,
  }
  // Only touch the ingredient breakdown when the caller supplies one,
  // so a plain field edit never wipes a scanned meal's ingredients.
  if (input.ingredients) patch.ai_raw_response = ingredientsPayload(input.ingredients)
  // Likewise the photo — only when a new one was attached.
  if (input.photo_storage_path !== undefined) patch.photo_storage_path = input.photo_storage_path
  const { data, error } = await supabase.from('meals').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteMeal(id: string): Promise<void> {
  const { error } = await supabase.from('meals').delete().eq('id', id)
  if (error) throw error
}
