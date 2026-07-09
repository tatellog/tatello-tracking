/*
 * Findings Engine (R1) · read path del cliente + fallback (T2.4).
 *
 * Lee los HALLAZGOS de un periodo del writer (edge `compute-findings`, que
 * computa + persiste con el MISMO buildFindings del cliente). Si el edge falla o
 * no hay red, cae a **compute-local** con las señales/ctx/prior que el cliente ya
 * tiene (efímero, no persiste) → la UI nunca se queda sin hallazgos. Es la infra
 * del "flip" del ADR; el cableado a Órbita es F5, detrás de flag y tras paridad.
 */
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'

import type { DailySignals } from './api'
import { buildFindings, type Finding, type FindingsCtx } from './findings'
import type { PriorReflections } from './reflections'

type Period = 'day' | 'week' | 'month' | 'last30'

// El Finding es complejo (nested); validamos lo esencial y confiamos en el resto
// (lo produce NUESTRO edge con NUESTRO buildFindings). `.passthrough()` conserva
// los campos extra.
const ServerFindingSchema = z
  .object({ id: z.string().min(1), confidence: z.number() })
  .passthrough()
const FindingsResponseSchema = z.object({ findings: z.array(ServerFindingSchema) })

/** Pide los hallazgos al writer (edge). null si falla → el hook cae al
 *  compute-local. Nunca lanza. */
async function fetchFindingsFromServer(
  period: Period,
  periodStart: string,
  periodEnd: string,
): Promise<Finding[] | null> {
  try {
    const { data, error } = await supabase.functions.invoke('compute-findings', {
      body: { period, periodStart, periodEnd },
    })
    if (error) return null
    if (data && (data as { error?: string }).error) return null
    const parsed = FindingsResponseSchema.safeParse(data)
    if (!parsed.success) return null
    return parsed.data.findings as unknown as Finding[]
  } catch {
    return null
  }
}

/**
 * Los hallazgos de un periodo. Primario: el writer (persiste). Fallback:
 * compute-local con `signals`/`ctx`/`prior` (no persiste). El camino feliz es
 * 100% server-side; los args de fallback solo se usan si el edge no responde.
 */
export function useFindings(params: {
  uid: string | null
  period: Period
  periodStart: string
  periodEnd: string
  signals: readonly DailySignals[]
  ctx?: FindingsCtx
  prior?: PriorReflections
}) {
  const { uid, period, periodStart, periodEnd, signals, ctx, prior } = params
  return useQuery({
    queryKey: uid
      ? queryKeys.orbit.findings(uid, period, periodStart, periodEnd)
      : ['orbit', 'findings', 'off'],
    queryFn: async (): Promise<Finding[]> => {
      const server = await fetchFindingsFromServer(period, periodStart, periodEnd)
      if (server) return server
      // Fallback determinístico (efímero): la UI no se queda sin hallazgos.
      return buildFindings(signals, ctx ?? {}, prior ?? {})
    },
    enabled: uid != null,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
