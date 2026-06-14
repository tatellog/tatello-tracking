import { z } from 'zod'

import { requireUserId, supabase } from '@/lib/supabase'
import type { Json } from '@/types/database.types'

/*
 * Capa de datos de las Revelaciones (tabla `revelations`, RLS estricto:
 * auth.uid() = user_id). Es a la vez el log de Historia y la fuente de
 * de-dup / rate-limit de las tres tiers. Spec: docs/revelations-system-spec.md.
 *
 * Voz: las revelaciones nunca juzgan/corrigen/recomiendan/diagnostican —
 * el `title` ya viene resuelto en voz del coach al momento de revelar.
 */

export const REVELATION_TIERS = ['transformation', 'return', 'pattern'] as const
export type RevelationTier = (typeof REVELATION_TIERS)[number]

const SELECT = 'id, tier, kind, title, shown_at, dismissed_at, metadata' as const

export const revelationRowSchema = z.object({
  id: z.string(),
  tier: z.enum(REVELATION_TIERS),
  kind: z.string(),
  title: z.string(),
  shown_at: z.string(),
  dismissed_at: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).catch({}),
})
export type RevelationRow = z.infer<typeof revelationRowSchema>

export type RecordRevelationInput = {
  tier: RevelationTier
  kind: string
  /** La línea de Historia, ya en voz del coach. */
  title: string
  /** Evidencia (p. ej. { count: 5, window_days: 7 }) — alimenta el copy. */
  metadata?: Record<string, unknown>
}

/**
 * Registra una revelación mostrada. Para transformación el índice único
 * parcial (user_id, kind) garantiza "una sola vez por umbral": un duplicado
 * lanza 23505 y aquí se traga como no-op (devuelve null) — el orquestador
 * no necesita pre-chequear, aunque igual lo hace para no intentar de más.
 */
export async function recordRevelation(
  input: RecordRevelationInput,
): Promise<RevelationRow | null> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('revelations')
    .insert({
      user_id: userId,
      tier: input.tier,
      kind: input.kind,
      title: input.title,
      metadata: (input.metadata ?? {}) as Json,
    })
    .select(SELECT)
    .single()
  if (error) {
    // 23505 = unique_violation → el umbral ya se reveló. Silencioso.
    if (error.code === '23505') return null
    throw error
  }
  return revelationRowSchema.parse(data)
}

/** Timeline de Historia — todas las revelaciones, más reciente primero. */
export async function listRevelations(limit = 50): Promise<RevelationRow[]> {
  const { data, error } = await supabase
    .from('revelations')
    .select(SELECT)
    .order('shown_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return z.array(revelationRowSchema).parse(data ?? [])
}

/** El `shown_at` más reciente (global o por tier) — para el rate-limit de
 *  patrones (1/7d) y el de-dup de regreso. null si nunca hubo. */
export async function lastRevelationAt(tier?: RevelationTier): Promise<Date | null> {
  let q = supabase
    .from('revelations')
    .select('shown_at')
    .order('shown_at', { ascending: false })
    .limit(1)
  if (tier) q = q.eq('tier', tier)
  const { data, error } = await q.maybeSingle()
  if (error) throw error
  return data?.shown_at ? new Date(data.shown_at) : null
}

/** Qué umbrales de transformación ya se revelaron ('25','50','75','100') —
 *  el orquestador no vuelve a disparar uno ya mostrado. */
export async function shownTransformationKinds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('revelations')
    .select('kind')
    .eq('tier', 'transformation')
  if (error) throw error
  return (data ?? []).map((r) => r.kind as string)
}

/** Marca una revelación como cerrada (fire-and-forget desde el cliente). */
export async function markRevelationDismissed(id: string): Promise<void> {
  const { error } = await supabase
    .from('revelations')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
