/*
 * Facts Engine (R1 · Engine 1) — registros → HECHOS agregados. Nunca interpreta,
 * solo calcula. REUSA el Context Engine (`buildPeriodContext`) para los valores
 * (una sola fuente de agregación → no divergir del hash dorado) y lo aplana al
 * contrato `Fact` (engine.ts).
 *
 * Puro y compartido (app + Edge Functions): sin RN, sin Supabase, sin Deno.
 * Lo llama el WRITER backend (persiste en `facts`) y el fallback del cliente.
 * Ref: docs/epics/epic-01-intelligence-engine.md (T1.2), docs/adr/0001-*.
 */
import { buildPeriodContext, type ContextPeriod, type ContextRow } from './context'
import type { Fact, Period } from './engine'

export type ComputeFactsInput = {
  period: ContextPeriod
  /** La VENTANA ESTABLE del periodo (ej. el mes: '2026-07-01'..'2026-07-31').
   *  Es el `Fact.period` persistido → llave idempotente del upsert. NO se deriva
   *  del rango de datos (que crece día a día y rompería el conflict key). */
  periodStart: string
  periodEnd: string
  /** Filas del periodo, deduplicadas (una por día). */
  signals: readonly ContextRow[]
  calorieTarget?: number | null
}

/**
 * daily_signals del periodo → los HECHOS (`Fact[]`). Emite SOLO hechos con
 * evidencia real: si un agregado es null (sin datos), no se inventa el hecho.
 * `evidenceCount` es el denominador honesto de cada hecho (días que lo sostienen).
 */
export function computeFacts(input: ComputeFactsInput): Fact[] {
  // Sin filas → sin hechos (nada que agregar).
  if (input.signals.length === 0) return []

  const ctx = buildPeriodContext({
    period: input.period,
    signals: input.signals,
    calorieTarget: input.calorieTarget,
  })
  const period: Period = { start: input.periodStart, end: input.periodEnd }
  const signals = input.signals
  const activeDays = signals.length
  const daysLogged = ctx.nutrition.daysLogged
  const sleepDays = signals.filter((s) => s.sleep_minutes != null).length
  const weighIns = signals.filter((s) => s.weight_kg != null).length
  const hasTarget = input.calorieTarget != null && input.calorieTarget > 0

  const facts: Fact[] = []
  const push = (kind: string, value: number | null, unit: string, evidenceCount: number) => {
    if (value == null) return
    facts.push({ kind, value, unit, evidenceCount, period })
  }

  // Nutrición — denominador honesto: días con comida registrada.
  push('days_logged', daysLogged, 'días', activeDays)
  if (daysLogged > 0) {
    push('deficit_days', ctx.nutrition.deficitDays, 'días', daysLogged)
    if (hasTarget) push('surplus_days', ctx.nutrition.surplusDays, 'días', daysLogged)
    push('avg_calories', ctx.nutrition.avgCalories, 'kcal', daysLogged)
    push('avg_protein', ctx.nutrition.avgProtein, 'g', daysLogged)
  }

  // Actividad.
  push('workout_days', ctx.activity.workoutDays, 'días', activeDays)
  push('workout_kcal_avg', ctx.activity.workoutKcalAvg, 'kcal', ctx.activity.workoutDays)

  // Sueño — solo si hay noches registradas.
  if (sleepDays > 0) {
    push('avg_sleep_minutes', ctx.sleep.avgSleepMinutes, 'min', sleepDays)
    push('days_slept_7h', ctx.sleep.daysAbove7h, 'días', sleepDays)
  }

  // Cuerpo — peso se auto-guarda por null (< 2 pesajes → sin cambio; 0 → sin último).
  push('weight_change_kg', ctx.body.weightChangeKg, 'kg', weighIns)
  push('latest_weight_kg', ctx.body.latestWeightKg, 'kg', weighIns)

  return facts
}
