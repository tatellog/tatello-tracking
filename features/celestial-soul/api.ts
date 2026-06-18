import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { requireUserId, supabase } from '@/lib/supabase'

import type { RevealSource } from './types'

/*
 * Capa de datos del Alma Celeste. La tabla `soul_node_reveals` es append-only:
 * guarda SOLO qué nodos reveló cada usuario (por signo). Todo el progreso se
 * deriva en el cliente con el motor puro (logic.ts) — el server no calcula nada.
 */

/** Ids de nodos revelados por el usuario para `sign`. El motor (logic.ts)
 *  ignora ids que ya no existan en el config actual, así un cambio de node-map
 *  nunca hace retroceder el progreso. */
export async function getSoulRevealIds(sign: ZodiacSign): Promise<string[]> {
  const { data, error } = await supabase
    .from('soul_node_reveals')
    .select('node_id')
    .eq('sign', sign)
  if (error) throw error
  return (data ?? []).map((r) => r.node_id)
}

/** Fuentes que YA revelaron un nodo desde `sinceIso` (día local). Sirve para el
 *  límite de 1 nodo por fuente por día sostenido. */
export async function getSoulRevealSourcesSince(
  sign: ZodiacSign,
  sinceIso: string,
): Promise<RevealSource[]> {
  const { data, error } = await supabase
    .from('soul_node_reveals')
    .select('source')
    .eq('sign', sign)
    .gte('revealed_at', sinceIso)
  if (error) throw error
  return (data ?? []).map((r) => r.source as RevealSource)
}

/** Revela un nodo (idempotente: on conflict do nothing). Permanente. */
export async function revealSoulNode(args: {
  sign: ZodiacSign
  nodeId: string
  source: RevealSource
  configVersion: number
}): Promise<void> {
  const userId = await requireUserId()
  const { error } = await supabase.from('soul_node_reveals').upsert(
    {
      user_id: userId,
      sign: args.sign,
      node_id: args.nodeId,
      source: args.source,
      config_version: args.configVersion,
    },
    { onConflict: 'user_id,sign,node_id', ignoreDuplicates: true },
  )
  if (error) throw error
}
