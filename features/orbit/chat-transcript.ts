/*
 * Transcript del chat guiado de Órbita Mes — persistencia del RENDER para
 * rehidratar al reabrir sin volver a pegarle a la IA.
 *
 * La generación cara (OpenAI) YA está cacheada server-side en `ai_insights`
 * (por findingsHash + árbol de turnos). Lo que falta es que el CLIENTE conserve
 * la conversación ya pintada entre aperturas del sheet: hoy vive en useState y
 * se destruye al cerrar, así que reabrir replaya N round-trips + la animación.
 *
 * Solución (recomendación del backend-specialist): guardar el transcript en el
 * cache de React Query, que este repo YA persiste a AsyncStorage 24 h (gcTime)
 * y limpia por cambio de usuario (lib/queryClient.ts). Cero red al reabrir (se
 * lee con getQueryData, sin queryFn), cero tabla, cero superficie RLS nueva. La
 * key incluye `findingsHash` → si cambian los datos del mes, el transcript viejo
 * queda huérfano y entra flujo fresco (bust correcto y automático).
 */
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { queryKeys } from '@/lib/queryKeys'

/**
 * Espejo del `PROMPT_VERSION` del edge `stelar-insight`. TRIPWIRE: si subes
 * PROMPT_VERSION allá, súbelo aquí — si no, un transcript viejo (copy de un
 * prompt viejo) se rehidrataría en vez de regenerarse. Hay un test
 * (chat-transcript.test.ts) que truena si divergen.
 */
export const CHAT_PROMPT_VERSION = 'v12'

/** Sube esto si cambia el SHAPE del transcript: fuerza miss de los guardados con
 *  el shape viejo (safeParse abajo ya los descarta, esto lo hace explícito). */
const TRANSCRIPT_SCHEMA_VERSION = 1

/** Una burbuja del hilo (mismo shape que `Entry` en FindingChatView). */
const ChatEntrySchema = z.union([
  z.object({ who: z.literal('stelar'), text: z.string().min(1), voice: z.boolean().optional() }),
  z.object({ who: z.literal('user'), label: z.string().min(1) }),
])

/** Las fases del chat (mismo union que `Phase` en FindingChatView). */
const PhaseSchema = z.enum(['opening', 'reply1', 'reply2', 'meta', 'closing'])

export const FindingTranscriptSchema = z.object({
  v: z.literal(TRANSCRIPT_SCHEMA_VERSION),
  log: z.array(ChatEntrySchema).min(1),
  chips: z.array(z.string()),
  phase: PhaseSchema,
  focus: z.string().nullable(),
  metaAnswer: z.string().nullable(),
  /** El camino de chips elegido (para continuar por una rama nueva desde aquí). */
  path: z.array(z.string()),
})

export type FindingTranscript = z.infer<typeof FindingTranscriptSchema>

/** Ensambla el objeto persistible desde el estado del chat (añade la versión). */
export function makeTranscript(t: Omit<FindingTranscript, 'v'>): FindingTranscript {
  return { v: TRANSCRIPT_SCHEMA_VERSION, ...t }
}

/**
 * Lee/guarda el transcript de UN hallazgo en el cache de React Query. `read`
 * valida con Zod en el borde (un cache persistido de una app vieja podría traer
 * un shape inválido → miss → flujo fresco). Sin uid (sesión sin usuario) es
 * no-op: nunca cachea cross-usuario.
 */
export function useFindingTranscript(uid: string | null, findingId: string, findingsHash: string) {
  const qc = useQueryClient()
  const key = uid
    ? queryKeys.orbit.aiChatTranscript(uid, findingId, findingsHash, CHAT_PROMPT_VERSION)
    : null

  const read = (): FindingTranscript | null => {
    if (!key) return null
    const parsed = FindingTranscriptSchema.safeParse(qc.getQueryData(key))
    return parsed.success ? parsed.data : null // shape viejo/ausente → miss
  }

  const save = (transcript: FindingTranscript): void => {
    // setQueryData sin queryFn: deja la query en estado success → el persister la
    // deshidrata como cualquier otra (sobrevive app-kill 24 h). Nunca hay red.
    if (key) qc.setQueryData(key, transcript)
  }

  return { read, save }
}
