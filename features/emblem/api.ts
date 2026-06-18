import { z } from 'zod'

import { supabase } from '@/lib/supabase'

/*
 * Capa de datos del Emblema Celeste — una sola RPC.
 *
 * fn_transform_points suma los días-hábito del HISTORIAL completo
 * (retroactivo, security invoker → RLS de la usuaria). Devuelve los
 * puntos crudos; el mapeo a etapas vive en logic.ts.
 */

const TransformPointsSchema = z.number().int().min(0)

export async function fetchTransformPoints(waterGoalGlasses: number): Promise<number> {
  const { data, error } = await supabase.rpc('fn_transform_points', {
    p_water_goal_glasses: waterGoalGlasses,
  })
  if (error) throw new Error(error.message)
  return TransformPointsSchema.parse(data)
}

/** Puntos del emblema acumulados HASTA `asOf` (YYYY-MM-DD, inclusive). Para el
 *  "antes" del % de constelación en la card "Tu Historia" de Progreso. */
export async function fetchTransformPointsAsOf(
  asOf: string,
  waterGoalGlasses: number,
): Promise<number> {
  const { data, error } = await supabase.rpc('fn_transform_points_as_of', {
    p_as_of: asOf,
    p_water_goal_glasses: waterGoalGlasses,
  })
  if (error) throw new Error(error.message)
  return TransformPointsSchema.parse(data)
}
