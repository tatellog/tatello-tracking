/*
 * AI Voice — el cliente de la edge function stelar-insight (AI Foundation).
 *
 * La voz de IA que EXPLICA los insights determinísticos. Gateada por
 * AI_VOICE_ENABLED: con el flag apagado, el hook devuelve null y la UI usa la
 * voz determinística de siempre. La edge function construye el contexto
 * server-side y cachea; el cliente solo pide y cachea el resultado (React
 * Query). Nunca bloquea la UI: cualquier fallo → null, la app sigue entera.
 */
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { AI_VOICE_ENABLED } from '@/lib/featureFlags'
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
  if (!AI_VOICE_ENABLED) return null
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
  return useQuery({
    queryKey:
      uid && req
        ? queryKeys.orbit.aiVoice(uid, req.feature, req.periodStart, req.periodEnd)
        : ['orbit', 'aiVoice', 'disabled'],
    queryFn: () => (req ? fetchAiVoice(req) : Promise.resolve(null)),
    enabled: AI_VOICE_ENABLED && uid != null && req != null,
    staleTime: 60 * 60 * 1000, // 1 h: la voz de un periodo no cambia seguido
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}
