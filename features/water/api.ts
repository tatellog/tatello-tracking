import { z } from 'zod'

import { requireUserId, supabase } from '@/lib/supabase'
import type { Json } from '@/types/database.types'

import type { DetectedLiquid } from './liquid-detection'

/*
 * Water intake is one row per user per day in `water_intake`, keyed
 * by (user_id, intake_date). A missing row simply means the day
 * hasn't been logged yet → 0 glasses.
 */

export async function getWaterGlasses(date: string): Promise<number> {
  const { data, error } = await supabase
    .from('water_intake')
    .select('glasses')
    .eq('intake_date', date)
    .maybeSingle()
  if (error) throw error
  return data?.glasses ?? 0
}

/** Glasses logged per day across an inclusive [startDate, endDate]
 *  range — feeds the water-consistency row in Comidas. Days with no
 *  row are simply absent (= 0). RLS scopes rows to the caller. */
export async function getWaterInRange(
  startDate: string,
  endDate: string,
): Promise<{ intake_date: string; glasses: number }[]> {
  const { data, error } = await supabase
    .from('water_intake')
    .select('intake_date, glasses')
    .gte('intake_date', startDate)
    .lte('intake_date', endDate)
  if (error) throw error
  return data ?? []
}

export async function setWaterGlasses(date: string, glasses: number): Promise<void> {
  const userId = await requireUserId()
  const { error } = await supabase.from('water_intake').upsert(
    {
      user_id: userId,
      intake_date: date,
      glasses,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,intake_date' },
  )
  if (error) throw error
}

/*
 * Suma `delta` vasos al agua DIRECTA del día (lee el actual y reescribe). Lo
 * usa el caso "registraste agua pura por el escáner de comida": no se crea
 * comida, el agua entra como directa (vasitos). water_intake.glasses es int,
 * así que el delta se redondea a vasos enteros y se clampa a 0-30.
 */
export async function addDirectWaterGlasses(date: string, delta: number): Promise<void> {
  const current = await getWaterGlasses(date)
  const next = Math.min(30, Math.max(0, Math.round(current + delta)))
  await setWaterGlasses(date, next)
}

/* ─── meal_hydration · agua derivada de comidas ──────────────────────── */

/*
 * El agua de un día tiene DOS orígenes: directa (water_intake, el stepper)
 * y derivada de comidas (meal_hydration, lo que la usuaria aceptó de los
 * líquidos detectados). El total que ve = directa + derivada-aceptada. La
 * derivada vive aparte para guardar el origen (qué comida), restarse sola
 * al borrar la comida (FK cascade) y recalcularse al editar (unique meal_id).
 */

/** Un líquido tal como queda guardado en meal_hydration.detected_items. */
export const StoredLiquidSchema = z.object({
  label: z.string(),
  factor: z.union([z.literal(1), z.literal(0.75), z.literal(0.5)]),
  glasses: z.number(),
})
export type StoredLiquid = z.infer<typeof StoredLiquidSchema>

const HydrationStatusSchema = z.enum(['accepted', 'rejected'])
export type HydrationStatus = z.infer<typeof HydrationStatusSchema>

export const MealHydrationInputSchema = z.object({
  mealId: z.string().uuid(),
  intakeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  // Tope 8 = espejo del CHECK de la tabla (2 L por comida).
  glasses: z.number().min(0).max(8),
  status: HydrationStatusSchema,
  items: z.array(StoredLiquidSchema),
})
export type MealHydrationInput = z.infer<typeof MealHydrationInputSchema>

/** Lo que una comida aporta hoy + su decisión guardada (para recalc al editar). */
export type MealHydration = {
  mealId: string
  intakeDate: string
  glasses: number
  status: HydrationStatus
  items: StoredLiquid[]
}

function parseStoredItems(raw: Json | null): StoredLiquid[] {
  const parsed = z.array(StoredLiquidSchema).safeParse(raw)
  return parsed.success ? parsed.data : []
}

/** Suma de vasos que las comidas ACEPTADAS aportan a un día. RLS scopes. */
export async function getWaterFromMeals(date: string): Promise<number> {
  const { data, error } = await supabase
    .from('meal_hydration')
    .select('glasses')
    .eq('intake_date', date)
    .eq('status', 'accepted')
  if (error) throw error
  const sum = (data ?? []).reduce((acc, r) => acc + (r.glasses ?? 0), 0)
  // Redondeo a 0.25 para que la suma de fracciones no arrastre flotantes.
  return Math.round(sum / 0.25) * 0.25
}

/** Desglose del agua del día: directa (stepper) + derivada de comidas. */
export async function getWaterBreakdown(
  date: string,
): Promise<{ direct: number; fromMeals: number; total: number }> {
  const [direct, fromMeals] = await Promise.all([getWaterGlasses(date), getWaterFromMeals(date)])
  return { direct, fromMeals, total: Math.round((direct + fromMeals) / 0.25) * 0.25 }
}

/** La decisión de hidratación guardada para UNA comida, o null si no hay. */
export async function getMealHydration(mealId: string): Promise<MealHydration | null> {
  const { data, error } = await supabase
    .from('meal_hydration')
    .select('meal_id, intake_date, glasses, status, detected_items')
    .eq('meal_id', mealId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    mealId: data.meal_id,
    intakeDate: data.intake_date,
    glasses: data.glasses,
    status: HydrationStatusSchema.parse(data.status),
    items: parseStoredItems(data.detected_items),
  }
}

/*
 * Guarda (o recalcula) el aporte de UNA comida. Upsert sobre meal_id: editar
 * la comida sobrescribe su fila — nunca duplica. status='rejected' guarda que
 * la usuaria vio los líquidos y dijo "no contar" (glasses 0), para no volver
 * a preguntar y para análisis. updated_at lo setea el cliente (igual que
 * water_intake; ver migración 20260619120000).
 */
export async function saveMealHydration(input: MealHydrationInput): Promise<void> {
  const userId = await requireUserId()
  const parsed = MealHydrationInputSchema.parse(input)
  const { error } = await supabase.from('meal_hydration').upsert(
    {
      user_id: userId,
      meal_id: parsed.mealId,
      intake_date: parsed.intakeDate,
      glasses: parsed.status === 'accepted' ? parsed.glasses : 0,
      status: parsed.status,
      detected_items: parsed.items as unknown as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'meal_id' },
  )
  if (error) throw error
}

/** Convierte la detección a items guardables (snapshot compacto). */
export function toStoredLiquids(items: DetectedLiquid[]): StoredLiquid[] {
  return items.map(({ label, factor, glasses }) => ({ label, factor, glasses }))
}
