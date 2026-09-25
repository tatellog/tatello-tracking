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
/* ── Arco de evidencia (V-10) · el reporte ANTERIOR ─────────────────── */

// Del reporte previo solo importan las categorías de sus findings (para el
// estado "confirmado" por recurrencia); lo demás se ignora.
const PriorReportSchema = z.object({
  report: z.object({
    findings: z.array(z.object({ category: z.string() }).passthrough()),
  }),
})

/** Días de separación mínima para que un reporte cuente como "historia":
 *  con ventanas rodantes (last30), un reporte de hace 3 días compartiría
 *  casi todos los días con el actual y la "recurrencia" sería un espejismo. */
const PRIOR_GAP_DAYS = 21

/**
 * Las categorías de findings del reporte persistido MÁS RECIENTE que cerró
 * hace ≥21 días (historia real, no la misma ventana). `[]` sin historia.
 * Alimenta `findingArcStage` (estado "confirmado" por recurrencia).
 */
export function usePriorFindingCategories(params: {
  uid: string | null
  todayIso: string
  enabled?: boolean
}) {
  const { uid, todayIso, enabled } = params
  const [y, m, d] = todayIso.split('-').map(Number) as [number, number, number]
  const cut = new Date(y, m - 1, d - PRIOR_GAP_DAYS, 12)
  const cutIso = `${cut.getFullYear()}-${String(cut.getMonth() + 1).padStart(2, '0')}-${String(cut.getDate()).padStart(2, '0')}`

  return useQuery({
    queryKey: uid ? queryKeys.orbit.priorFindings(uid, cutIso) : ['orbit', 'priorFindings', 'off'],
    enabled: uid != null && enabled !== false,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('monthly_reports')
        .select('report')
        .lt('period_end', cutIso)
        .order('period_end', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error || data == null) return []
      const parsed = PriorReportSchema.safeParse(data)
      if (!parsed.success) return []
      return [...new Set(parsed.data.report.findings.map((f) => f.category))]
    },
  })
}

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
