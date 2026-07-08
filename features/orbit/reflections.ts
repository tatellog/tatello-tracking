/*
 * Metacognición de Órbita Mes IA — persiste las respuestas de la usuaria a las
 * preguntas del chat guiado ("¿lo habías notado? sí/no/nunca"). Tabla
 * month_reflections (una respuesta por usuaria/mes/pregunta; upsert).
 *
 * Solo el GUARDADO: la lectura (hilar conversaciones con respuestas pasadas)
 * aún no se usa en ninguna superficie — cuando se necesite, se agrega un
 * `useReflections(month)` que lea de la misma tabla. Nunca bloquea la UI: un
 * guardado fallido no rompe la conversación.
 */
import { useMutation } from '@tanstack/react-query'

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

/** Guarda una respuesta de metacognición (fire-and-forget desde el chat). */
export function useSaveReflection(month: MonthKey) {
  return useMutation({
    mutationFn: ({ questionKey, answer }: Reflection) => saveReflection(month, questionKey, answer),
  })
}
