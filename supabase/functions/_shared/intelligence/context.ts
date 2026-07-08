/*
 * Context Engine — el resumen COMPACTO por usuario y periodo (AI Foundation,
 * docs/ai-foundation-spec.md · paso 1).
 *
 * Toma las filas de daily_signals ya deduplicadas y produce UN objeto plano,
 * serializable, con solo agregados — jamás registros raw. Es lo único que se
 * inyecta a un prompt (la IA explica este resumen; no ve los datos crudos).
 *
 * Puro y compartido (app + Edge Functions): sin React Native, sin Supabase,
 * sin Deno globals. La regla "día en déficit" se importa de deficit.ts (fuente
 * única). El superávit es el complemento honesto: consumo POR ENCIMA del
 * target (no cualquier no-déficit — un día muy bajo el piso no es superávit).
 *
 * NOTA pasos: wearable_steps es ingest-only y NO vive en daily_signals (spec
 * wearables §1), así que avgSteps se difiere hasta decidir su superficie.
 */
import { DEFICIT_FLOOR_RATIO, isDeficitDay } from './deficit'
import type { DailySignals } from './types'

/** Una fila de contexto = daily_signals + la kcal del wearable (columna
 *  nueva de la view que el shared DailySignals aún no lista). Opcional para
 *  no romper fixtures que no la incluyan. */
export type ContextRow = DailySignals & { workout_kcal?: number | null }

export type ContextPeriod = 'day' | 'week' | 'month' | 'last30'

/** Sueño "suficiente": ≥ 7 h (420 min) — el mismo umbral honesto de Órbita. */
export const SLEEP_ENOUGH_MINUTES = 420

export type NutritionContext = {
  avgCalories: number | null
  avgProtein: number | null
  deficitDays: number
  surplusDays: number
  /** Días con comida registrada (el denominador honesto: sin comida no se
   *  juzga el día). */
  daysLogged: number
}

export type ActivityContext = {
  workoutDays: number
  /** Promedio de kcal quemadas en los días que el wearable las trajo; null si
   *  ningún entreno tuvo dato (nunca 0 como si hubiera entrenado sin quemar). */
  workoutKcalAvg: number | null
}

export type SleepContext = {
  avgSleepMinutes: number | null
  daysAbove7h: number
}

export type BodyContext = {
  /** Peso más reciente menos el más antiguo del periodo (kg, 1 decimal);
   *  null si hay menos de 2 pesajes. Negativo = bajó. */
  weightChangeKg: number | null
  latestWeightKg: number | null
}

/** Deltas contra el periodo anterior (mismos campos numéricos clave). null en
 *  cada campo cuando falta el dato en alguno de los dos periodos. */
export type ContextComparison = {
  avgCaloriesDelta: number | null
  avgProteinDelta: number | null
  deficitDaysDelta: number
  workoutDaysDelta: number
  avgSleepMinutesDelta: number | null
  weightChangeKgDelta: number | null
}

export type PeriodContext = {
  period: ContextPeriod
  dateRange: { start: string; end: string } | null
  nutrition: NutritionContext
  activity: ActivityContext
  sleep: SleepContext
  body: BodyContext
  /** Comparación vs periodo anterior (solo si se pasó `previous`). */
  vsPrevious?: ContextComparison
  /** Los insights determinísticos ya detectados (los llena el Insights
   *  Engine; el Context Engine lo deja vacío). */
  patterns: unknown[]
}

export type PeriodContextInput = {
  period: ContextPeriod
  /** Filas del periodo, deduplicadas (una por día). */
  signals: readonly ContextRow[]
  calorieTarget?: number | null
  /** Filas del periodo ANTERIOR (misma longitud aprox.), para la
   *  comparación. Omitir si no se quiere `vsPrevious`. */
  previous?: readonly ContextRow[]
}

const round = (n: number): number => Math.round(n)
const round1 = (n: number): number => Math.round(n * 10) / 10

/** Promedio de los valores no-nulos, o null si no hay ninguno. */
function avgOf(values: readonly (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => v != null)
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function nutritionOf(
  signals: readonly ContextRow[],
  target: number | null | undefined,
): NutritionContext {
  const withFood = signals.filter((s) => (s.meal_count ?? 0) > 0 || (s.calories ?? 0) > 0)
  const avgCal = avgOf(withFood.map((s) => s.calories))
  const avgProt = avgOf(withFood.map((s) => s.protein_g))
  const deficitDays = signals.filter((s) => isDeficitDay(s.calories, target)).length
  // Superávit = consumo POR ENCIMA del target (no el complemento de déficit:
  // un día muy bajo el piso no es superávit, es su propia cosa).
  const surplusDays =
    target != null && target > 0
      ? signals.filter((s) => s.calories != null && s.calories > target).length
      : 0
  return {
    avgCalories: avgCal != null ? round(avgCal) : null,
    avgProtein: avgProt != null ? round(avgProt) : null,
    deficitDays,
    surplusDays,
    daysLogged: withFood.length,
  }
}

function activityOf(signals: readonly ContextRow[]): ActivityContext {
  const trained = signals.filter((s) => s.trained === true)
  const kcal = avgOf(trained.map((s) => s.workout_kcal))
  return {
    workoutDays: trained.length,
    workoutKcalAvg: kcal != null ? round(kcal) : null,
  }
}

function sleepOf(signals: readonly ContextRow[]): SleepContext {
  const avg = avgOf(signals.map((s) => s.sleep_minutes))
  const daysAbove7h = signals.filter((s) => (s.sleep_minutes ?? 0) >= SLEEP_ENOUGH_MINUTES).length
  return {
    avgSleepMinutes: avg != null ? round(avg) : null,
    daysAbove7h,
  }
}

function bodyOf(signals: readonly ContextRow[]): BodyContext {
  // Ordenar por día ascendente y tomar pesajes reales (ignora días sin peso).
  const weighed = signals
    .filter(
      (s): s is ContextRow & { weight_kg: number; day: string } =>
        s.weight_kg != null && s.day != null,
    )
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day))
  if (weighed.length === 0) return { weightChangeKg: null, latestWeightKg: null }
  const latest = weighed[weighed.length - 1]!.weight_kg
  const change =
    weighed.length >= 2 ? weighed[weighed.length - 1]!.weight_kg - weighed[0]!.weight_kg : null
  return {
    weightChangeKg: change != null ? round1(change) : null,
    latestWeightKg: round1(latest),
  }
}

/** El rango de fechas cubierto por las filas (min..max de `day`), o null. */
function dateRangeOf(signals: readonly ContextRow[]): { start: string; end: string } | null {
  const days = signals.map((s) => s.day).filter((d): d is string => d != null)
  if (days.length === 0) return null
  days.sort((a, b) => a.localeCompare(b))
  return { start: days[0]!, end: days[days.length - 1]! }
}

function comparisonOf(
  cur: PeriodContext,
  prevSignals: readonly ContextRow[],
  target: number | null | undefined,
): ContextComparison {
  const prev = {
    nutrition: nutritionOf(prevSignals, target),
    activity: activityOf(prevSignals),
    sleep: sleepOf(prevSignals),
    body: bodyOf(prevSignals),
  }
  const numDelta = (a: number | null, b: number | null): number | null =>
    a != null && b != null ? round1(a - b) : null
  return {
    avgCaloriesDelta: numDelta(cur.nutrition.avgCalories, prev.nutrition.avgCalories),
    avgProteinDelta: numDelta(cur.nutrition.avgProtein, prev.nutrition.avgProtein),
    deficitDaysDelta: cur.nutrition.deficitDays - prev.nutrition.deficitDays,
    workoutDaysDelta: cur.activity.workoutDays - prev.activity.workoutDays,
    avgSleepMinutesDelta: numDelta(cur.sleep.avgSleepMinutes, prev.sleep.avgSleepMinutes),
    weightChangeKgDelta: numDelta(cur.body.weightChangeKg, prev.body.weightChangeKg),
  }
}

/**
 * El resumen compacto del periodo. Determinístico, plano, serializable — lo
 * único que se inyecta a un prompt. `patterns` lo llena el Insights Engine.
 */
export function buildPeriodContext(input: PeriodContextInput): PeriodContext {
  const { period, signals, calorieTarget, previous } = input
  const ctx: PeriodContext = {
    period,
    dateRange: dateRangeOf(signals),
    nutrition: nutritionOf(signals, calorieTarget),
    activity: activityOf(signals),
    sleep: sleepOf(signals),
    body: bodyOf(signals),
    patterns: [],
  }
  if (previous && previous.length > 0) {
    ctx.vsPrevious = comparisonOf(ctx, previous, calorieTarget)
  }
  return ctx
}

/* Re-export de la constante para tests / callers que la necesiten. */
export { DEFICIT_FLOOR_RATIO }
