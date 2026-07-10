/*
 * Metacognición de Órbita Mes IA — persiste las respuestas de la usuaria a las
 * preguntas del chat guiado ("¿lo habías notado? sí/no/nunca"). Tabla
 * month_reflections (una respuesta por usuaria/mes/pregunta; upsert).
 *
 * GUARDA + LEE: el guardado alimenta el "cerrar el loop" — al volver a una
 * pregunta que ya contestó en un mes ANTERIOR, Stelar la recuerda ("En mayo
 * no lo habías notado"). La lectura solo trae meses previos (nunca el actual,
 * para no auto-referenciarse). Nunca bloquea la UI: un fallo → sin callback.
 */
import { useMutation, useQuery } from '@tanstack/react-query'

import { requireUserId, supabase } from '@/lib/supabase'

/** 'YYYY-MM' del mes del que habla la conversación. */
export type MonthKey = string

export type Reflection = { questionKey: string; answer: string }

/** Por cada pregunta, la respuesta más reciente de un mes ANTERIOR. */
export type PriorReflections = Record<string, { month: MonthKey; answer: string }>

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

/** Guarda una respuesta de metacognición (fire-and-forget desde el chat). */
export function useSaveReflection(month: MonthKey) {
  return useMutation({
    mutationFn: ({ questionKey, answer }: Reflection) => saveReflection(month, questionKey, answer),
  })
}

/** Trae las respuestas de meses ANTERIORES a `currentMonth`, quedándose con la
 *  más reciente por pregunta. Vacío si es su primer mes (loop no activa). */
export async function fetchPriorReflections(currentMonth: MonthKey): Promise<PriorReflections> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('month_reflections')
    .select('month, question_key, answer')
    .eq('user_id', userId)
    .lt('month', currentMonth)
    // Los focos ("me lo quedo presente") comparten la tabla con un prefijo
    // 'foco:'; no son respuestas de metacognición → fuera del loop de callbacks.
    .not('question_key', 'like', 'foco:%')
    .order('month', { ascending: false })
  if (error) throw error
  const out: PriorReflections = {}
  for (const row of data ?? []) {
    // order desc → la primera vista de cada clave es la más reciente.
    if (!out[row.question_key]) out[row.question_key] = { month: row.month, answer: row.answer }
  }
  return out
}

/** Lee las reflexiones previas para cerrar el loop. Gateada por sesión; nunca
 *  bloquea (error → sin callbacks, la conversación sigue igual). */
export function usePriorReflections(currentMonth: MonthKey, uid: string | null) {
  return useQuery({
    queryKey: ['orbit', 'reflections', 'prior', uid, currentMonth],
    queryFn: () => fetchPriorReflections(currentMonth),
    enabled: uid != null,
    staleTime: 60 * 60 * 1000, // 1 h: las respuestas de meses viejos no cambian
    refetchOnWindowFocus: false,
  })
}
