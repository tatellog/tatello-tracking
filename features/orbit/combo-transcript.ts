/*
 * La MEMORIA del chat del patrón dominante: al reabrir con el mismo patrón,
 * Stelar no repite la charla, abre en tu foco y guarda "Lo que hablamos".
 *
 * Vive en AsyncStorage (no en el caché de React Query, que se purga a las 24 h):
 * una conversación de hace una semana sigue siendo tuya. La key lleva el uid
 * (nunca cruza cuentas) y el hash del patrón (si el patrón cambia de forma o de
 * evidencia, es otra conversación). React Query solo la espeja para que la card
 * sepa pintar "Retomar con Stelar" sin leer disco en cada render.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { queryKeys } from '@/lib/queryKeys'

import { CHAT_PROMPT_VERSION } from './chat-transcript'

const STORAGE_PREFIX = 'stelar.combo-chat'

const EntrySchema = z.union([
  z.object({
    who: z.literal('stelar'),
    text: z.string().min(1),
    voice: z.boolean().optional(),
    /** Días de la evidencia de esta respuesta (se pueden tocar). */
    days: z.array(z.string()).optional(),
  }),
  z.object({ who: z.literal('user'), label: z.string().min(1) }),
])
export type ComboEntry = z.infer<typeof EntrySchema>

export const ComboTranscriptSchema = z.object({
  v: z.literal(1),
  promptVersion: z.string(),
  /** Último día en que hablaron (YYYY-MM-DD). */
  talkedOn: z.string(),
  log: z.array(EntrySchema).min(1),
  usedFactIds: z.array(z.string()),
  metaAnswer: z.string().nullable(),
})
export type ComboTranscript = z.infer<typeof ComboTranscriptSchema>

const storageKey = (uid: string, hash: string) => `${STORAGE_PREFIX}:${uid}:${hash}`

async function readTranscript(uid: string, hash: string): Promise<ComboTranscript | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid, hash))
    if (!raw) return null
    const parsed = ComboTranscriptSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    // Un prompt viejo: su copy ya no es el de hoy → conversación nueva.
    return parsed.data.promptVersion === CHAT_PROMPT_VERSION ? parsed.data : null
  } catch {
    return null
  }
}

export function makeComboTranscript(
  t: Omit<ComboTranscript, 'v' | 'promptVersion'>,
): ComboTranscript {
  return { v: 1, promptVersion: CHAT_PROMPT_VERSION, ...t }
}

/** La conversación guardada del patrón (null = nunca hablaron de este patrón). */
export function useComboTranscript(uid: string | null, hash: string | null) {
  const qc = useQueryClient()
  const key = uid && hash ? queryKeys.orbit.comboTranscript(uid, hash) : null
  const query = useQuery({
    queryKey: key ?? ['orbit', 'comboChat', 'off'],
    queryFn: () => (uid && hash ? readTranscript(uid, hash) : Promise.resolve(null)),
    enabled: key != null,
    staleTime: Infinity,
  })
  const save = (t: ComboTranscript) => {
    if (!uid || !hash || !key) return
    qc.setQueryData(key, t)
    AsyncStorage.setItem(storageKey(uid, hash), JSON.stringify(t)).catch(() => {})
  }
  return { transcript: query.data ?? null, loading: query.isLoading && key != null, save }
}
