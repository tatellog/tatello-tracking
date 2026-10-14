/*
 * Dónde vive la respuesta a "¿Esto coincide con tus días?": solo en el
 * teléfono (AsyncStorage + caché de query), y como evento. Si se pierde, lo
 * peor es que la pregunta vuelva a aparecer. La lógica es pura
 * (insight-feedback.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { track } from '@/lib/analytics'

import {
  parseFeedbackState,
  recordFeedback,
  type FeedbackAnswer,
  type FeedbackState,
} from './insight-feedback'
import type { InsightMeta } from './insight-events'

const storageKey = (uid: string) => `stelar.insight-feedback:${uid}`
const queryKey = (uid: string) => ['orbit', 'insightFeedback', uid] as const

async function read(uid: string): Promise<FeedbackState> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid))
    return parseFeedbackState(raw ? JSON.parse(raw) : {})
  } catch {
    return {}
  }
}

export function useInsightFeedback(uid: string | null) {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: uid ? queryKey(uid) : ['orbit', 'insightFeedback', 'off'],
    queryFn: () => read(uid!),
    enabled: uid != null,
    staleTime: Infinity,
  })
  return {
    answerOf: (id: string): FeedbackAnswer | null => q.data?.[id] ?? null,
    submit: (id: string, answer: FeedbackAnswer, meta: InsightMeta) => {
      if (!uid) return
      const key = queryKey(uid)
      const prev = qc.getQueryData<FeedbackState>(key) ?? {}
      if (prev[id]) return
      // Al instante en pantalla; el teléfono lo guarda detrás.
      qc.setQueryData(key, recordFeedback(prev, id, answer))
      track('insight_feedback_submitted', { ...meta, answer })
      void read(uid)
        .then((s) =>
          AsyncStorage.setItem(storageKey(uid), JSON.stringify(recordFeedback(s, id, answer))),
        )
        .catch(() => {})
    },
  }
}
