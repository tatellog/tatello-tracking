/*
 * Facts Engine (R1) · read path del cliente + fallback (T1.4).
 *
 * Lee los HECHOS de un periodo del writer (edge `compute-facts`, que computa +
 * persiste). Si el edge falla o no hay red, cae a **compute-local** con las
 * señales que el cliente ya tiene (efímero, no persiste) → la UI nunca se queda
 * sin hechos. Es la infra del "flip" del ADR (docs/adr/0001-*); el cableado a
 * las superficies (Órbita) es F5, detrás de flag y tras probar paridad.
 */
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'

import type { DailySignals } from './api'
import { computeFacts } from './facts'
import type { Fact } from './engine-types'

type Period = 'day' | 'week' | 'month' | 'last30'

const FactSchema = z.object({
  kind: z.string().min(1),
  value: z.number(),
  unit: z.string().nullish(),
  evidenceCount: z.number(),
  period: z.object({ start: z.string(), end: z.string() }),
})
const FactsResponseSchema = z.object({ facts: z.array(FactSchema) })

/** Pide los hechos al writer (edge). Devuelve null si falla → el hook cae al
 *  compute-local. Nunca lanza. */
async function fetchFactsFromServer(
  period: Period,
  periodStart: string,
  periodEnd: string,
): Promise<Fact[] | null> {
  try {
    const { data, error } = await supabase.functions.invoke('compute-facts', {
      body: { period, periodStart, periodEnd },
    })
    if (error) return null
    if (data && (data as { error?: string }).error) return null
    const parsed = FactsResponseSchema.safeParse(data)
    if (!parsed.success) return null
    return parsed.data.facts.map((f) => ({
      kind: f.kind,
      value: f.value,
      unit: f.unit ?? undefined,
      evidenceCount: f.evidenceCount,
      period: f.period,
    }))
  } catch {
    return null
  }
}

/**
 * Los hechos de un periodo. Primario: el writer (persiste). Fallback:
 * compute-local con `signals` (no persiste). `signals`/`calorieTarget` solo se
 * usan en el fallback; el camino feliz es 100% server-side.
 */
export function useFacts(params: {
  uid: string | null
  period: Period
  periodStart: string
  periodEnd: string
  /** Para el fallback de compute-local si el edge no responde. */
  signals: readonly DailySignals[]
  calorieTarget?: number | null
}) {
  const { uid, period, periodStart, periodEnd, signals, calorieTarget } = params
  return useQuery({
    queryKey: uid
      ? queryKeys.orbit.facts(uid, period, periodStart, periodEnd)
      : ['orbit', 'facts', 'off'],
    queryFn: async (): Promise<Fact[]> => {
      const server = await fetchFactsFromServer(period, periodStart, periodEnd)
      if (server) return server
      // Fallback determinístico (efímero): la UI no se queda sin hechos.
      return computeFacts({ period, periodStart, periodEnd, signals, calorieTarget })
    },
    enabled: uid != null,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
