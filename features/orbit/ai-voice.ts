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

/* ── Experimento (R5): la IA redacta el FOCO del hilo ─────────────────── */

/** El foco redactado por IA para un experimento, o null (flag off / error /
 *  rechazo del backstop) → la UI cae al determinístico. Nunca lanza. */
export async function fetchExperimentCopy(input: {
  periodStart: string
  periodEnd: string
  metricLabel: string
  hypothesis: string
  subject?: string
}): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('stelar-insight', {
      body: {
        feature: 'experimento',
        periodType: 'last30',
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        experiment: {
          metricLabel: input.metricLabel,
          hypothesis: input.hypothesis,
          subject: input.subject,
        },
      },
    })
    if (error) return null
    if (data && (data as { error?: string }).error) return null
    const text = (data as { text?: unknown })?.text
    return typeof text === 'string' ? text : null
  } catch {
    return null
  }
}

/** El foco del experimento activo (gateado a dev). Cacheado por el id del
 *  experimento; regenera solo si cambia. Fallback: la UI muestra la hipótesis. */
export function useExperimentCopy(params: {
  uid: string | null
  periodStart: string | null
  periodEnd: string | null
  metricLabel: string
  hypothesis: string
  subject?: string
  cacheKey: string
}) {
  const { session } = useSession()
  const aiOn = aiEnabledForEmail(session?.user?.email)
  const ready =
    aiOn &&
    params.uid != null &&
    params.periodStart != null &&
    params.periodEnd != null &&
    params.metricLabel.length > 0 &&
    params.hypothesis.length > 0
  return useQuery({
    queryKey: params.uid
      ? queryKeys.orbit.aiExperiment(params.uid, params.cacheKey)
      : ['orbit', 'aiVoice', 'experiment', 'off'],
    queryFn: () =>
      ready
        ? fetchExperimentCopy({
            periodStart: params.periodStart!,
            periodEnd: params.periodEnd!,
            metricLabel: params.metricLabel,
            hypothesis: params.hypothesis,
            subject: params.subject,
          })
        : Promise.resolve(null),
    enabled: ready,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}

/* ── Órbita Mes: CHAT guiado (un turno a la vez, IA conduce) ──────────── */

/** El hallazgo que la IA conversa (verdad determinística; nunca inventa). */
export type ChatFindingInput = {
  id: string
  /** La dimensión en humano ("tus días con tu meta de agua"): la IA abre
   *  nombrándola para que cada hallazgo se sienta distinto. */
  subject: string
  /** La lectura determinística (semilla de la apertura, no se copia literal). */
  lead: string
  support: string
  northLink?: string | null
  hypothesis?: string | null
  /** El contrapunto ("los días que NO"): para responder de verdad esa pregunta. */
  contrast?: string | null
  /** La palanca del motor ("cuida los viernes"): la IA la VISTE en el cierre. */
  lever?: string | null
}

export type MonthChatTurn = {
  message: { text: string; tone?: 'accent' | 'strong' }
  chips: string[]
  /** La palanca corta y accionable del cierre ("cuida el agua el finde"), para
   *  que la usuaria se la quede como foco concreto. Solo en el turno final. */
  focus?: string | null
}

const MonthChatTurnSchema = z.object({
  message: z.object({ text: z.string().min(1), tone: z.enum(['accent', 'strong']).nullish() }),
  chips: z.array(z.string()),
  focus: z.string().nullish(),
  cached: z.boolean().optional(),
})

/** Pide UN turno de la charla guiada. Devuelve {message, chips} o null (→ el
 *  chat cae al beat determinístico de ese turno). El cliente controla el conteo
 *  y el cierre (isFinal); la metacognición si/no/nunca la maneja el cliente. */
export async function fetchMonthChatTurn(params: {
  periodStart: string
  periodEnd: string
  findingsHash: string
  finding: ChatFindingInput
  turnIndex: number
  isFinal: boolean
  path: string[]
}): Promise<MonthChatTurn | null> {
  try {
    const { data, error } = await supabase.functions.invoke('stelar-insight', {
      body: {
        feature: 'orbita_mes_chat',
        periodType: 'month',
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        findingsHash: params.findingsHash,
        finding: params.finding,
        turnIndex: params.turnIndex,
        isFinal: params.isFinal,
        path: params.path,
      },
    })
    if (error) return null
    if (data && (data as { error?: string }).error) return null
    const parsed = MonthChatTurnSchema.safeParse(data)
    if (!parsed.success) return null
    return {
      message: { text: parsed.data.message.text, tone: parsed.data.message.tone ?? undefined },
      chips: parsed.data.chips,
      focus: parsed.data.focus ?? null,
    }
  } catch {
    return null
  }
}
