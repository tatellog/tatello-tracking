/*
 * AI Voice — el cliente de la edge function stelar-insight (AI Foundation).
 *
 * La voz de IA que EXPLICA los insights determinísticos. Gateada POR USUARIO
 * (aiEnabledForEmail): para una cuenta no habilitada el hook devuelve null y
 * la UI usa la voz determinística de siempre. La edge function construye el
 * contexto server-side y cachea; el cliente solo pide y cachea el resultado
 * (React Query). Nunca bloquea la UI: cualquier fallo → null, la app entera.
 */
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { useSession } from '@/hooks/useSession'
import { aiEnabledForEmail } from '@/lib/featureFlags'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'

import type { VozParte } from './mock'

export type AiVoiceFeature = 'orbita_dia' | 'orbita_semana' | 'orbita_mes' | 'progreso'
export type AiVoicePeriod = 'day' | 'week' | 'month' | 'last30'

const VozResponseSchema = z.object({
  voz: z
    .array(
      z.object({
        text: z.string().min(1),
        tone: z.enum(['accent', 'strong']).nullish(),
      }),
    )
    .min(1),
  cached: z.boolean().optional(),
})

export type AiVoiceRequest = {
  feature: AiVoiceFeature
  periodType: AiVoicePeriod
  periodStart: string
  periodEnd: string
  /** Hallazgos determinísticos ya detectados (frases planas) que la IA
   *  explica. Opcional. */
  insights?: string[]
}

/** Llama a stelar-insight y devuelve las partes de voz, o null si el flag
 *  está apagado o algo falla (la UI cae a la voz determinística). */
export async function fetchAiVoice(req: AiVoiceRequest): Promise<VozParte[] | null> {
  // El gate por-usuario vive en useAiVoice (enabled); fetchAiVoice es la
  // llamada cruda (la edge exige JWT válido). La pantalla DEV la usa directo.
  try {
    const { data, error } = await supabase.functions.invoke('stelar-insight', { body: req })
    if (error) return null
    if (data && (data as { error?: string }).error) return null
    const parsed = VozResponseSchema.safeParse(data)
    if (!parsed.success) return null
    return parsed.data.voz.map((v) => ({ text: v.text, tone: v.tone ?? undefined }))
  } catch {
    return null
  }
}

/**
 * Hook de la voz de IA de una superficie. Devuelve null mientras el flag esté
 * apagado (cero red). El caché de React Query + el caché server (ai_insights)
 * juntos evitan re-llamar la IA cuando nada cambió.
 */
export function useAiVoice(uid: string | null, req: AiVoiceRequest | null) {
  const { session } = useSession()
  const aiOn = aiEnabledForEmail(session?.user?.email)
  return useQuery({
    queryKey:
      uid && req
        ? queryKeys.orbit.aiVoice(uid, req.feature, req.periodStart, req.periodEnd)
        : ['orbit', 'aiVoice', 'disabled'],
    queryFn: () => (req ? fetchAiVoice(req) : Promise.resolve(null)),
    enabled: aiOn && uid != null && req != null,
    staleTime: 60 * 60 * 1000, // 1 h: la voz de un periodo no cambia seguido
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}

/* ── Órbita Mes: voz POR HALLAZGO (la IA reformula lead/caption) ──────── */

/** Lo que el cliente manda por hallazgo. La IA reescribe `lead` y `caption`
 *  (la lectura y la nota); `support` (con NÚMEROS) NUNCA lo toca la IA. */
export type MonthFindingInput = { id: string; lead: string; support: string; caption: string }

/** Voz de IA de una card: solo la parte redactable. Los números viven en el
 *  motor determinístico, no aquí. */
export type MonthCardVoice = { lead: string; caption: string }

const MonthVoiceResponseSchema = z.object({
  cards: z
    .array(z.object({ id: z.string().min(1), lead: z.string().min(1), caption: z.string().min(1) }))
    .min(1),
  cached: z.boolean().optional(),
})

/** Mapa id→voz, o null si el flag está apagado / algo falla (cae a la voz
 *  determinística `finding.phrase`). Nunca lanza; nunca bloquea la UI. */
export async function fetchMonthVoice(
  periodStart: string,
  periodEnd: string,
  findings: MonthFindingInput[],
): Promise<Record<string, MonthCardVoice> | null> {
  try {
    const { data, error } = await supabase.functions.invoke('stelar-insight', {
      body: { feature: 'orbita_mes', periodType: 'month', periodStart, periodEnd, findings },
    })
    if (error) return null
    if (data && (data as { error?: string }).error) return null
    const parsed = MonthVoiceResponseSchema.safeParse(data)
    if (!parsed.success) return null
    const map: Record<string, MonthCardVoice> = {}
    for (const c of parsed.data.cards) map[c.id] = { lead: c.lead, caption: c.caption }
    return map
  } catch {
    return null
  }
}

/**
 * Voz de IA de las cards del Mes, cacheada POR HALLAZGO. La query key lleva el
 * `hash` de los hallazgos: si no cambian, React Query no re-pide (cero red). Y
 * el edge, keyed por el mismo hash, no re-llama a GPT si los hallazgos son los
 * mismos. Regenera solo cuando cambia lo que se muestra.
 */
export function useMonthVoice(
  uid: string | null,
  periodStart: string | null,
  periodEnd: string | null,
  findings: MonthFindingInput[],
  hash: string,
) {
  const { session } = useSession()
  const aiOn = aiEnabledForEmail(session?.user?.email)
  const ready =
    aiOn && uid != null && periodStart != null && periodEnd != null && findings.length > 0
  return useQuery({
    queryKey: uid ? queryKeys.orbit.aiMonthVoice(uid, hash) : ['orbit', 'aiVoice', 'month', 'off'],
    queryFn: () =>
      ready ? fetchMonthVoice(periodStart!, periodEnd!, findings) : Promise.resolve(null),
    enabled: ready,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}
