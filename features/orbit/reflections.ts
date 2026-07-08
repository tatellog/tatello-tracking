/*
 * Metacognición de Órbita Mes IA — persiste las respuestas de la usuaria a las
 * preguntas del chat guiado ("¿lo habías notado? sí/no/nunca"). Tabla
 * month_reflections (una respuesta por usuaria/mes/pregunta; upsert).
 *
 * api.ts + hooks juntos porque es una superficie chica. Nunca bloquea la UI:
 * un guardado fallido no rompe la conversación (fire-and-forget con
 * invalidación optimista).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { requireUserId, supabase } from '@/lib/supabase'

/** 'YYYY-MM' del mes del que habla la conversación. */
export type MonthKey = string

export type Reflection = { questionKey: string; answer: string }

/** Guarda (o reemplaza) la respuesta de una pregunta para un mes. */
export async function saveReflection(
  month: MonthKey,
  questionKey: string,
  answer: string,
): Promise<void> {
  const userId = await requireUserId()
  const { error } = await supabase
    .from('month_reflections')
    .upsert(
      { user_id: userId, month, question_key: questionKey, answer },
      { onConflict: 'user_id,month,question_key' },
    )
  if (error) throw error
}

/** Todas las respuestas de un mes, como mapa questionKey → answer. */
export async function fetchReflections(month: MonthKey): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('month_reflections')
    .select('question_key, answer')
    .eq('month', month)
  if (error) throw error
  const out: Record<string, string> = {}
  for (const r of data ?? []) out[r.question_key] = r.answer
  return out
}

const keyFor = (month: MonthKey) => ['orbit', 'reflections', month] as const

/** Las respuestas ya dadas este mes (para no re-preguntar y para hilar
 *  conversaciones: "la vez pasada no lo habías notado…"). */
export function useReflections(month: MonthKey) {
  return useQuery({
    queryKey: keyFor(month),
    queryFn: () => fetchReflections(month),
    staleTime: 5 * 60 * 1000,
  })
}

/** Guarda una respuesta y refresca el mapa del mes. */
export function useSaveReflection(month: MonthKey) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ questionKey, answer }: Reflection) => saveReflection(month, questionKey, answer),
    onSuccess: (_data, vars) => {
      // Optimista: mete la respuesta en el cache del mes al instante.
      qc.setQueryData<Record<string, string>>(keyFor(month), (prev) => ({
        ...(prev ?? {}),
        [vars.questionKey]: vars.answer,
      }))
    },
  })
}
