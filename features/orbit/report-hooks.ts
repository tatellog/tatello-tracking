/*
 * Monthly Report (R1 · integrador final) · read path del cliente + fallback
 * (Epic 01 · F5 · T5.3, el "flip").
 *
 * Lee el REPORTE ENSAMBLADO de un periodo del writer (edge `compute-findings`,
 * que ya devuelve `report` y lo persiste en `monthly_reports` con el MISMO
 * buildMonthlyReport del cliente). Si el edge falla o no hay red, cae a
 * **compute-local** con las señales/ctx/prior que el cliente ya tiene (efímero,
 * no persiste) → la UI nunca se queda sin reporte.
 *
 * Solo se activa cuando USE_PERSISTED_MONTH_REPORT está ON (via `enabled`);
 * mientras esté OFF el hook no dispara red y Órbita Mes computa local como hoy.
 */
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'

import type { DailySignals } from './api'
import type { MonthlyReport } from './engine-types'
import type { FindingsCtx } from './findings'
import type { PriorReflections } from './reflections'
import { buildMonthlyReport } from './report'

type Period = 'day' | 'week' | 'month' | 'last30'

// El MonthlyReport es complejo (findings anidados); validamos lo esencial y
// confiamos en el resto (lo produce NUESTRO edge con NUESTRO buildMonthlyReport).
// `.passthrough()` conserva verdict/stories/hypotheses/findings intactos.
const ReportSchema = z
  .object({
    month: z.string().min(1),
    findingsHash: z.string().min(1),
    findings: z.array(z.object({ id: z.string().min(1) }).passthrough()),
  })
  .passthrough()
const ReportResponseSchema = z.object({ report: ReportSchema })

/** Pide el reporte al writer (edge). null si falla → el hook cae al
 *  compute-local. Nunca lanza. */
async function fetchReportFromServer(
  period: Period,
  periodStart: string,
  periodEnd: string,
): Promise<MonthlyReport | null> {
  try {
    const { data, error } = await supabase.functions.invoke('compute-findings', {
      body: { period, periodStart, periodEnd },
    })
    if (error) return null
    if (data && (data as { error?: string }).error) return null
    const parsed = ReportResponseSchema.safeParse(data)
    if (!parsed.success) return null
    return parsed.data.report as unknown as MonthlyReport
  } catch {
    return null
  }
}

/**
 * El reporte ensamblado de un periodo. Primario: el writer (persiste). Fallback:
 * compute-local con `signals`/`ctx`/`prior` (no persiste). Pasa `enabled: false`
 * (o uid null) para dejarlo dormido mientras el flip está apagado.
 */
export function useMonthlyReport(params: {
  uid: string | null
  month: string
  period: Period
  periodStart: string
  periodEnd: string
  signals: readonly DailySignals[]
  ctx?: FindingsCtx
  prior?: PriorReflections
  enabled?: boolean
}) {
  const { uid, month, period, periodStart, periodEnd, signals, ctx, prior, enabled } = params
  return useQuery({
    queryKey: uid
      ? queryKeys.orbit.monthlyReport(uid, period, periodStart, periodEnd)
      : ['orbit', 'monthlyReport', 'off'],
    queryFn: async (): Promise<MonthlyReport> => {
      const server = await fetchReportFromServer(period, periodStart, periodEnd)
      if (server) return server
      // Fallback determinístico (efímero): la UI no se queda sin reporte.
      return buildMonthlyReport(month, signals, ctx ?? {}, prior ?? {})
    },
    enabled: uid != null && enabled !== false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
