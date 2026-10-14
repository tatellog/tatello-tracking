/*
 * "¿Esto coincide con tus días?" (ST-008 corte 2 · plan §2,
 * `insight_feedback_submitted`). Puro: qué respuestas hay y qué se recuerda.
 *
 * La respuesta es OPINIÓN, no evidencia (decisión §11): no cambia lo que el
 * motor detecta. Solo se manda como evento y se recuerda en el teléfono para
 * no volver a preguntar. "No coincide" además lo saca de Hoy (dueña 14 oct
 * 2026); en Descubre se queda, es su evidencia.
 */

export const FEEDBACK_ANSWERS = ['matches', 'no_match', 'unsure'] as const
export type FeedbackAnswer = (typeof FEEDBACK_ANSWERS)[number]

/** Id del hallazgo → su respuesta. */
export type FeedbackState = Record<string, FeedbackAnswer>

const isAnswer = (v: unknown): v is FeedbackAnswer =>
  typeof v === 'string' && (FEEDBACK_ANSWERS as readonly string[]).includes(v)

/** Lo leído del teléfono, sin basura (una versión vieja o un valor roto). */
export function parseFeedbackState(raw: unknown): FeedbackState {
  if (!raw || typeof raw !== 'object') return {}
  const out: FeedbackState = {}
  for (const [id, v] of Object.entries(raw)) if (isAnswer(v)) out[id] = v
  return out
}

/** La primera respuesta se queda: no se vuelve a preguntar ni se reescribe. */
export function recordFeedback(
  state: FeedbackState,
  id: string,
  answer: FeedbackAnswer,
): FeedbackState {
  return state[id] ? state : { ...state, [id]: answer }
}
