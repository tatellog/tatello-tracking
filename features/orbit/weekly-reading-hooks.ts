import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { useSession } from '@/hooks/useSession'
import { track } from '@/lib/analytics'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'
import { todayInTimezone } from '@/lib/time'

import { useIsoWeekSignals } from './hooks'
import { lastClosedWeekStart, weekHasReading } from './weekly-reading'

/*
 * Lectura Semanal (V-05) — hooks del lado cliente. La edge `weekly-reading`
 * calcula la última semana CERRADA con el motor compartido y la persiste en
 * `weekly_readings` (inmutable); aquí solo se pide, se valida en el borde
 * (Zod) y se marca abierta (opened_at = métrica "Insights Opened per Week").
 */

const LeverSchema = z.object({
  kind: z.enum(['finde', 'entre-semana', 'proteina']),
  text: z.string(),
})

export const WeeklyReadingSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  grade: z.enum(['completa', 'parcial']),
  daysWithFood: z.number(),
  deficitDays: z.number(),
  kcalAvg: z.number().nullable(),
  tdee: z
    .object({
      tdee: z.number(),
      kcalAvg: z.number(),
      deltaKg: z.number(),
      spanDays: z.number(),
      dataDays: z.number(),
      quality: z.enum(['solida', 'temprana']),
    })
    .nullable(),
  paceKgWeek: z.number().nullable(),
  opening: z.string(),
  body: z.array(z.string()),
  lever: LeverSchema.nullable(),
  closing: z.string(),
})

const ResponseSchema = z.object({
  reading: WeeklyReadingSchema.nullable(),
  openedAt: z.string().nullable().optional(),
})

export type WeeklyReadingRow = z.infer<typeof ResponseSchema>

/** La lectura de la última semana cerrada (on-read-miss en la edge).
 *  `reading: null` = silencio honesto (semana sin datos suficientes).
 *  Key scopeada por uid: la caché jamás cruza cuentas en un dispositivo. */
export function useWeeklyReading(enabled: boolean) {
  const uid = useSession().session?.user?.id ?? null
  const today = todayInTimezone()
  const weekStart = lastClosedWeekStart(today)
  return useQuery({
    queryKey: queryKeys.orbit.weeklyReading(uid ?? 'anon', weekStart),
    enabled: enabled && uid != null,
    // Inmutable por diseño: una vez traída, no re-pedir en la sesión. El
    // silencio (reading null) SÍ se vuelve a pedir: la semana puede
    // completarse por backfill, y no debe quedar guardado en disco (H9).
    staleTime: (q) => (q.state.data?.reading == null ? 0 : Infinity),
    queryFn: async (): Promise<WeeklyReadingRow> => {
      const { data, error } = await supabase.functions.invoke('weekly-reading', {
        body: { todayIso: today },
      })
      if (error) throw new Error('Tu lectura no está disponible ahora.')
      const parsed = ResponseSchema.safeParse(data)
      if (!parsed.success) throw new Error('Tu lectura no está disponible ahora.')
      return parsed.data
    },
  })
}

/** Marca la lectura como abierta (una vez) y deja la huella TTFI. Va por
 *  la MISMA edge (action 'open'): opened_at es lo único mutable de la fila
 *  y el cliente no necesita conocer la tabla. */
export function useMarkWeeklyReadingOpened() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (weekStart: string) => {
      const { error } = await supabase.functions.invoke('weekly-reading', {
        body: { todayIso: todayInTimezone(), action: 'open' },
      })
      if (error) throw new Error('No pudimos marcar tu lectura.')
      return weekStart
    },
    onSuccess: (weekStart) => {
      track('insight_opened', { source: 'weekly_reading', week_start: weekStart })
      void qc.invalidateQueries({ queryKey: ['orbit', 'weeklyReading'] })
    },
  })
}

const StatusSchema = z.object({ opened_at: z.string().nullable() }).nullable()

/**
 * ¿Hay lectura de la última semana cerrada, y ya la abriste? SIN generarla
 * (ST-010 · H8): la lectura se congela cuando la usuaria la toca, no cuando
 * Hoy se monta. "Disponible" = la semana juntó los días mínimos (la misma
 * regla del motor); "abierta" = su fila ya tiene opened_at (lectura directa
 * de la tabla, RLS de la propia usuaria).
 */
export function useWeeklyReadingAvailability(enabled: boolean) {
  const uid = useSession().session?.user?.id ?? null
  const today = todayInTimezone()
  const weekStart = lastClosedWeekStart(today)
  const week = useIsoWeekSignals()
  const status = useQuery({
    queryKey: [...queryKeys.orbit.weeklyReading(uid ?? 'anon', weekStart), 'status'],
    enabled: enabled && uid != null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_readings')
        .select('opened_at')
        .eq('week_start', weekStart)
        .maybeSingle()
      if (error) throw error
      return StatusSchema.parse(data)
    },
  })
  const available = enabled && weekHasReading(week.data ?? [], weekStart)
  return {
    weekStart,
    available,
    /** Ya existe y está abierta (solo se sabe cuando la consulta respondió). */
    opened: status.data?.opened_at != null,
    loaded: status.isSuccess,
  }
}
