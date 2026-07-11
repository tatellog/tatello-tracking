/*
 * "Me lo quedo presente" — focos que la usuaria decide seguir mirando (Stage 2
 * del rediseño de Mes). NO es un experimento: no hay ventana, ni contador, ni
 * veredicto, ni forma de "fallar". Solo Stelar recordando en qué te fijaste.
 *
 * Persiste en `month_reflections` (misma tabla RLS del loop de metacognición,
 * sin migración) con la clave namespaced `foco:<findingId>`. El `answer` guarda
 * el subject del hallazgo para pintar "Lo que fuiste mirando" sin re-derivar nada.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { requireUserId, supabase } from '@/lib/supabase'

/** Prefijo de clave que separa los focos de las respuestas de metacognición
 *  dentro de la misma tabla. La lectura de metacognición los excluye. */
export const FOCO_PREFIX = 'foco:'

/** `foco` = la palanca concreta y accionable ("cuida el agua el finde"), NO el
 *  tema. Es lo que hace útil quedárselo (un foco específico, no un gesto vago). */
export type KeptFoco = { findingId: string; foco: string; month: string }

/** Guarda (o reafirma) un foco para el mes. Idempotente: volver a guardarlo no
 *  duplica (upsert por user/mes/clave). Guarda la PALANCA concreta. */
export async function keepFoco(
  month: string,
  input: { findingId: string; foco: string },
): Promise<void> {
  const userId = await requireUserId()
  const { error } = await supabase.from('month_reflections').upsert(
    {
      user_id: userId,
      month,
      question_key: `${FOCO_PREFIX}${input.findingId}`,
      answer: input.foco,
    },
    { onConflict: 'user_id,month,question_key' },
  )
  if (error) throw error
}

/** Los focos que la usuaria se ha quedado mirando, del más reciente al más
 *  viejo. Nunca lanza: ante error devuelve []. */
export async function fetchKeptFocos(): Promise<KeptFoco[]> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('month_reflections')
    .select('month, question_key, answer')
    .eq('user_id', userId)
    .like('question_key', `${FOCO_PREFIX}%`)
    .order('month', { ascending: false })
  if (error || !data) return []
  return data.map((r) => ({
    findingId: r.question_key.slice(FOCO_PREFIX.length),
    foco: r.answer,
    month: r.month,
  }))
}

/** Marca un foco como "presente". Refresca la lista al terminar. */
export function useKeepFoco(month: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { findingId: string; foco: string }) => keepFoco(month, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['orbit', 'focos'] }),
  })
}

/** Lee los focos guardados. Gateada por sesión; nunca bloquea la UI. */
export function useKeptFocos(uid: string | null) {
  return useQuery({
    queryKey: ['orbit', 'focos', uid],
    queryFn: fetchKeptFocos,
    enabled: uid != null,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
