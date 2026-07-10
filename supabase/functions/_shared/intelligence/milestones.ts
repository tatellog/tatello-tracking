/*
 * Milestones (R3 · "Historia") — motor puro de HITOS de primera vez. Puro,
 * determinístico, compartido (app + Edge Functions). Sin React, Supabase ni
 * globals de Deno.
 *
 * Detecta hitos escasos y celebrables desde daily_signals (déficit, peso y
 * entreno ya viven ahí): la primera vez que pasó algo, o un umbral simbólico
 * alcanzado. Son de "primera vez" → una vez por usuaria (el writer inserta con
 * on-conflict-do-nothing contra el índice parcial de `revelations`).
 *
 * Voz Historia: una línea corta en voz del coach, evidencia sin culpa (el
 * déficit es el norte de la usuaria, no una restricción a vigilar · alineado con
 * el veredicto de Órbita). Determinístico: las fechas salen de los datos, sin
 * reloj. La IA no participa.
 *
 * Epic 03 · F-R3 · T-R3.2. Ref: engine.ts, docs/epics/epic-03-progress.md.
 * DEFERIDO en R3: `best_streak` (recurre, necesita diseño aparte) y
 * `first_wearable` (R4).
 */
import { isDeficitDay } from './deficit'
import type { DailySignals } from './types'

export type MilestoneKind = 'first_deficit' | 'deficit_month' | 'first_weight' | 'first_workout'

/** Un hito para la Historia: qué, cuándo (ISO 'YYYY-MM-DD') y su línea de coach. */
export type Milestone = {
  kind: MilestoneKind
  date: string
  title: string
}

/** Días en déficit que suman "un mes" simbólico (no un mes calendario). */
export const DEFICIT_MONTH_DAYS = 20

const TITLES: Record<MilestoneKind, string> = {
  first_deficit: 'Tu primer día en déficit.',
  deficit_month: 'Tu primer mes en déficit.',
  first_weight: 'Tu primer pesaje.',
  first_workout: 'Tu primer entreno.',
}

const milestone = (kind: MilestoneKind, date: string): Milestone => ({
  kind,
  date,
  title: TITLES[kind],
})

/** Días con fecha, en orden cronológico (los hitos son "la primera vez"). */
function chronological(signals: readonly DailySignals[]): (DailySignals & { day: string })[] {
  return signals
    .filter((s): s is DailySignals & { day: string } => !!s.day)
    .slice()
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
}

export type MilestoneInput = {
  signals: readonly DailySignals[]
  calorieTarget?: number | null
}

/**
 * Los hitos alcanzados, en orden cronológico. Cada uno aparece a lo sumo una vez
 * (la primera fecha que lo cumplió). Vacío si aún no hay datos suficientes.
 */
export function detectMilestones(input: MilestoneInput): Milestone[] {
  const rows = chronological(input.signals)
  const out: Milestone[] = []

  // Primer día en déficit (y el "mes" acumulado: la fecha del día en déficit N°20).
  let deficitCount = 0
  let firstDeficit: string | null = null
  let deficitMonth: string | null = null
  for (const r of rows) {
    if (r.calories == null || r.calories <= 0) continue
    if (!isDeficitDay(r.calories, input.calorieTarget)) continue
    deficitCount++
    if (firstDeficit == null) firstDeficit = r.day
    if (deficitMonth == null && deficitCount >= DEFICIT_MONTH_DAYS) deficitMonth = r.day
  }
  if (firstDeficit) out.push(milestone('first_deficit', firstDeficit))
  if (deficitMonth) out.push(milestone('deficit_month', deficitMonth))

  // Primer pesaje y primer entreno (la primera fecha con ese dato).
  const firstWeight = rows.find((r) => r.weight_kg != null)?.day
  if (firstWeight) out.push(milestone('first_weight', firstWeight))

  const firstWorkout = rows.find((r) => r.trained === true)?.day
  if (firstWorkout) out.push(milestone('first_workout', firstWorkout))

  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}
