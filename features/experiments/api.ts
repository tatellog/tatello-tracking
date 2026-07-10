/*
 * Experiments (R5) · capa de datos del cliente (Zod + Supabase · T-A3).
 *
 * READERS del spine: leen la tabla `experiments` (fuente de verdad del activo) y
 * `hypotheses` con su STATUS REAL (no el 'open' que trae el MonthlyReport). RLS
 * scopea todo al caller; igual filtramos por si acaso. Los tipos de dominio del
 * ciclo de vida viven en features/experiments/logic.ts (puente a _shared).
 */
import { z } from 'zod'

import { supabase } from '@/lib/supabase'

type Period = 'day' | 'week' | 'month' | 'last30'

/** Fila de `experiments`. `plan`/`result` son jsonb → objeto laxo (passthrough).
 *  El status se valida contra el enum. */
export const ExperimentRowSchema = z.object({
  id: z.string().uuid(),
  hypothesis_id: z.string().uuid(),
  dimension: z.string(),
  status: z.enum(['running', 'confirmed', 'discarded', 'inconclusive']),
  started_on: z.string(),
  ends_on: z.string(),
  plan: z.record(z.string(), z.unknown()).nullable().default({}),
  result: z.record(z.string(), z.unknown()).nullable().default(null),
  closed_at: z.string().nullable(),
})
export type ExperimentRow = z.infer<typeof ExperimentRowSchema>

/** Fila de `hypotheses` con su status real (para R5). */
export const HypothesisRowSchema = z.object({
  id: z.string().uuid(),
  hypothesis_id: z.string(),
  text: z.string(),
  confidence: z.number(),
  status: z.enum(['open', 'experimenting', 'confirmed', 'discarded', 'inconclusive']),
  source_finding_id: z.string().nullable(),
  source_story_id: z.string().nullable(),
})
export type HypothesisRow = z.infer<typeof HypothesisRowSchema>

/** El experimento ACTIVO (running) de la usuaria, o null. ≤1 por el índice
 *  parcial de la DB. Nunca lanza: ante un error de red/parseo devuelve null. */
export async function fetchActiveExperiment(): Promise<ExperimentRow | null> {
  const { data, error } = await supabase
    .from('experiments')
    .select('id, hypothesis_id, dimension, status, started_on, ends_on, plan, result, closed_at')
    .eq('status', 'running')
    .maybeSingle()
  if (error || !data) return null
  const parsed = ExperimentRowSchema.safeParse(data)
  return parsed.success ? parsed.data : null
}

/** Las hipótesis de la usuaria en un periodo, con status real, por confianza. */
export async function fetchHypotheses(
  period: Period,
  periodStart: string,
  periodEnd: string,
): Promise<HypothesisRow[]> {
  const { data, error } = await supabase
    .from('hypotheses')
    .select('id, hypothesis_id, text, confidence, status, source_finding_id, source_story_id')
    .eq('period_type', period)
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .order('confidence', { ascending: false })
  if (error || !data) return []
  return data.flatMap((row) => {
    const parsed = HypothesisRowSchema.safeParse(row)
    return parsed.success ? [parsed.data] : []
  })
}
