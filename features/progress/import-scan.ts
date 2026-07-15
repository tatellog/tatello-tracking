import * as ImageManipulator from 'expo-image-manipulator'
import { z } from 'zod'

import { supabase } from '@/lib/supabase'

/*
 * Importar mediciones desde una FOTO o un PDF de la tabla del coach
 * (pedido dueña 15 jul 2026): la edge function scan-measurements transcribe
 * con gpt-4o-mini (server-side, la key jamás en el bundle) y devuelve una
 * entrada por fecha con las columnas canónicas de body_checkins. La UI
 * SIEMPRE muestra revisión antes de guardar: datos de salud — la usuaria
 * confirma, la IA solo transcribe. Mismo patrón probado de meal-scan.
 */

const SCAN_ERROR = 'No pudimos leer tu tabla. Intenta de nuevo.'

const num = z.number().nullable().optional()
export const ScannedValuesSchema = z.object({
  weight_kg: num,
  bmi: num,
  bmr_kcal: num,
  water_pct: num,
  bone_mass_kg: num,
  metabolic_age: num,
  visceral_fat_index: num,
  muscle_kg: num,
  muscle_arm_right_kg: num,
  muscle_arm_left_kg: num,
  muscle_trunk_kg: num,
  muscle_leg_right_kg: num,
  muscle_leg_left_kg: num,
  body_fat_pct: num,
  fat_arm_right_pct: num,
  fat_arm_left_pct: num,
  fat_trunk_pct: num,
  fat_leg_right_pct: num,
  fat_leg_left_pct: num,
  neck_cm: num,
  chest_cm: num,
  waist_cm: num,
  abdomen_cm: num,
  hips_cm: num,
  arm_right_cm: num,
  arm_left_cm: num,
  thigh_right_cm: num,
  thigh_left_cm: num,
  calf_right_cm: num,
  calf_left_cm: num,
})

export const ScannedCheckinSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** false = la columna solo traía mes/año; el día 15 es estimado. */
  dateExact: z.boolean().default(true),
  values: ScannedValuesSchema,
})

export const ScanTableResponseSchema = z.object({
  checkins: z.array(ScannedCheckinSchema).max(8),
  confidence: z.enum(['alta', 'media', 'baja']).default('alta'),
})

export type ScannedValues = z.infer<typeof ScannedValuesSchema>
export type ScannedCheckin = z.infer<typeof ScannedCheckinSchema>
export type ScanTableResult = z.infer<typeof ScanTableResponseSchema>

async function invokeScan(body: Record<string, string>): Promise<ScanTableResult> {
  const { data, error } = await supabase.functions.invoke('scan-measurements', { body })
  if (error) throw new Error(SCAN_ERROR)
  const parsed = ScanTableResponseSchema.safeParse(data)
  if (!parsed.success) throw new Error(SCAN_ERROR)
  return parsed.data
}

/** Foto de la tabla → resize (las tablas piden detalle: 1400px) → scan. */
export async function scanMeasurementsImage(photoUri: string): Promise<ScanTableResult> {
  const processed = await ImageManipulator.manipulateAsync(
    photoUri,
    [{ resize: { width: 1400 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  )
  if (!processed.base64) throw new Error(SCAN_ERROR)
  return invokeScan({ imageBase64: processed.base64, mimeType: 'image/jpeg' })
}

/** PDF (base64) → scan vía la rama input_file de la edge function. */
export async function scanMeasurementsPdf(pdfBase64: string): Promise<ScanTableResult> {
  return invokeScan({ pdfBase64 })
}
