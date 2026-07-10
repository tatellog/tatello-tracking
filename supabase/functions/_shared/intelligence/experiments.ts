/*
 * Experiments (R5) — lógica pura del ciclo de vida de un experimento. Puro,
 * determinístico, compartido (app + Edge Functions). Sin React, Supabase ni
 * globals de Deno.
 *
 * Convierte una HIPÓTESIS (del Hypothesis Engine, R1) en un EXPERIMENTO medible
 * y reversible. Reglas duras del PRD: UN activo a la vez, ≤2 semanas, siempre
 * medible, siempre reversible. El RESULTADO (confirmada/descartada/inconclusa)
 * lo decide el motor midiendo daily_signals (ver measureExperiment, T-B2), NUNCA
 * la IA. La IA de R5 solo redacta el copy (C, detrás del flag).
 *
 * DECISIÓN DE MANIFIESTO: este scaffold produce solo la ESTRUCTURA MEDIBLE
 * (dimensión, métrica, dirección, ventana) — nunca una frase prescriptiva tipo
 * "duerme 30 min más". La prosa cálida es trabajo de la IA (C). Así el spine
 * queda manifiesto-safe: son números y enums, no una orden.
 *
 * Epic 05 · F-B · T-B1. Ref: engine.ts (Finding/Hypothesis), epic-05.
 */
import { isDeficitDay } from './deficit.ts'
import type { Finding, FindingCategory, Hypothesis } from './engine.ts'
import type { DailySignals } from './types.ts'
import { WATER_GOAL_GLASSES } from './water.ts'

/** Estado del experimento (espejo del enum de la tabla `experiments`). */
export type ExperimentStatus = 'running' | 'confirmed' | 'discarded' | 'inconclusive'

/** Los estados TERMINALES (el resultado). Inmutables una vez alcanzados. */
export const TERMINAL_STATUSES: readonly ExperimentStatus[] = [
  'confirmed',
  'discarded',
  'inconclusive',
]

/** La señal por-día que el experimento mide. Cada una se cuenta como "día que
 *  cumplió" sobre la ventana (ver measureExperiment, T-B2). */
export type ExperimentMetric =
  | 'deficit_days'
  | 'workout_days'
  | 'days_slept_7h'
  | 'water_goal_days'
  | 'protein_target_days'

/** Hacia dónde se busca mover la métrica. `maintain` = sostener, no subir. */
export type ExperimentDirection = 'increase' | 'decrease' | 'maintain'

/** El PLAN medible (lo que se guarda en experiments.plan jsonb). Solo estructura:
 *  la prosa la pone la IA (C). `baseline`/`target` los llena el writer (A2) con
 *  datos reales al crear; aquí se define el marco. */
export type ExperimentPlan = {
  /** La dimensión en juego (reusa la categoría del Finding fuente). */
  dimension: FindingCategory
  /** La señal medible sobre la ventana. */
  metric: ExperimentMetric
  /** Dirección buscada (siempre reversible: sostener el foco unos días). */
  direction: ExperimentDirection
  /** Duración en días. SIEMPRE ≤14 (≤2 semanas · regla del PRD). */
  durationDays: number
}

/** Duración por defecto (2 semanas · el máximo permitido). */
export const DEFAULT_DURATION_DAYS = 14
/** Tope duro del PRD: nunca más de 2 semanas. */
export const MAX_DURATION_DAYS = 14

/** Cada dimensión medible → su métrica por-día. Todas se buscan `increase`
 *  (sostener más días el foco); `alimentacion` no mapea a un experimento
 *  reversible limpio, así que no genera scaffold (honestidad: no todo hallazgo
 *  se vuelve experimento). */
const METRIC_BY_DIMENSION: Partial<Record<FindingCategory, ExperimentMetric>> = {
  deficit: 'deficit_days',
  movimiento: 'workout_days',
  sueno: 'days_slept_7h',
  agua: 'water_goal_days',
  proteina: 'protein_target_days',
}

/**
 * Convierte una hipótesis + su Finding fuente en un PLAN medible, o null si la
 * dimensión no da un experimento reversible limpio. Determinístico y puro: mismo
 * input, mismo plan. NO decide baseline/target (los pone el writer con datos) ni
 * escribe prosa (eso es la IA).
 */
export function buildExperimentScaffold(
  hypothesis: Pick<Hypothesis, 'id' | 'sourceFindingId'>,
  sourceFinding: Pick<Finding, 'id' | 'category'>,
  opts: { durationDays?: number } = {},
): ExperimentPlan | null {
  // La hipótesis debe venir del Finding que se pasa (integridad del par).
  if (hypothesis.sourceFindingId && hypothesis.sourceFindingId !== sourceFinding.id) return null
  const metric = METRIC_BY_DIMENSION[sourceFinding.category]
  if (!metric) return null

  const durationDays = clampDuration(opts.durationDays ?? DEFAULT_DURATION_DAYS)
  if (durationDays < 1) return null

  return {
    dimension: sourceFinding.category,
    metric,
    direction: 'increase',
    durationDays,
  }
}

/** Acota la duración al rango [1, MAX_DURATION_DAYS]. Enteriza (días completos). */
export function clampDuration(days: number): number {
  if (!Number.isFinite(days)) return 0
  return Math.max(1, Math.min(MAX_DURATION_DAYS, Math.floor(days)))
}

/** ¿El experimento ya terminó (tiene resultado)? */
export function isTerminal(status: ExperimentStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

/**
 * ¿Es válido cerrar un experimento de `from` a `to`? Solo `running` → un estado
 * terminal. Un experimento cerrado NO se reabre (el resultado es inmutable, como
 * la constelación · [[immutable-vs-recalculable]]).
 */
export function canCloseTo(from: ExperimentStatus, to: ExperimentStatus): boolean {
  return from === 'running' && isTerminal(to)
}

/**
 * La regla "≤1 activo a la vez" en código (espejo del índice único parcial de la
 * DB). Solo se puede arrancar si no hay ninguno corriendo.
 */
export function canStart(activeRunningCount: number): boolean {
  return activeRunningCount === 0
}

/* ── Medición del resultado (T-B2) ─────────────────────────────────────────
 *
 * El motor DECIDE confirmada/descartada/inconclusa comparando la tasa de la
 * ventana del experimento contra una LÍNEA BASE (la tasa previa de esa misma
 * métrica). La IA no participa. Cada métrica se cuenta con el MISMO criterio que
 * el resto del motor (isDeficitDay, umbral de agua, 7h de sueño), para que un
 * "día que cumple" signifique lo mismo en todo Stelar.
 */

/** Minutos de sueño que cuentan como "dormiste 7h o más" (igual que findings). */
const SLEEP_7H_MIN = 420
/** Mejora mínima (en proporción) para no confundir ruido con efecto. */
export const RESULT_MARGIN = 0.1
/** Días mínimos de LÍNEA BASE para arriesgar un veredicto: sin base no se puede
 *  hablar de "mejora" (comparar contra 0 días haría pasar "no había datos" por
 *  "mejoró"). Bajo esto → inconclusa. */
export const MIN_BASELINE_DAYS = 4
/** ¿Es un día registrado (hubo presencia)? Para métricas donde cada día es una
 *  oportunidad (entreno), no solo los días con ese valor puntual. */
function isLoggedDay(s: DailySignals): boolean {
  return (
    s.calories != null ||
    (s.meal_count ?? 0) > 0 ||
    s.sleep_minutes != null ||
    s.trained != null ||
    (s.water_glasses ?? 0) > 0
  )
}

type MetricCtx = { calorieTarget?: number | null; proteinTarget?: number | null }
/** Por métrica: qué día es EVALUABLE (tiene el dato) y cuál CUMPLE. */
const METRIC_RULES: Record<
  ExperimentMetric,
  {
    evaluable: (s: DailySignals, c: MetricCtx) => boolean
    hit: (s: DailySignals, c: MetricCtx) => boolean
  }
> = {
  deficit_days: {
    evaluable: (s, c) => s.calories != null && s.calories > 0 && c.calorieTarget != null,
    hit: (s, c) => isDeficitDay(s.calories, c.calorieTarget),
  },
  protein_target_days: {
    evaluable: (s, c) => s.protein_g != null && c.proteinTarget != null,
    hit: (s, c) => (s.protein_g ?? 0) >= (c.proteinTarget ?? Infinity),
  },
  days_slept_7h: {
    evaluable: (s) => s.sleep_minutes != null,
    hit: (s) => (s.sleep_minutes ?? 0) >= SLEEP_7H_MIN,
  },
  water_goal_days: {
    evaluable: (s) => s.water_glasses != null,
    hit: (s) => (s.water_glasses ?? 0) >= WATER_GOAL_GLASSES,
  },
  workout_days: {
    evaluable: (s) => isLoggedDay(s),
    hit: (s) => s.trained === true,
  },
}

export type MetricRate = { hitDays: number; daysMeasured: number; rate: number }

/**
 * La tasa de una métrica sobre un set de días: cuántos días evaluables cumplen.
 * Puro. Lo usa la ventana del experimento Y la línea base (mismo criterio en
 * ambos lados de la comparación).
 */
export function computeMetricRate(
  metric: ExperimentMetric,
  signals: readonly DailySignals[],
  ctx: MetricCtx = {},
): MetricRate {
  const rule = METRIC_RULES[metric]
  const measured = signals.filter((s) => rule.evaluable(s, ctx))
  const hitDays = measured.filter((s) => rule.hit(s, ctx)).length
  const daysMeasured = measured.length
  return { hitDays, daysMeasured, rate: daysMeasured > 0 ? hitDays / daysMeasured : 0 }
}

export type ExperimentMeasurement = {
  /** Siempre un estado TERMINAL (nunca 'running'). */
  status: Extract<ExperimentStatus, 'confirmed' | 'discarded' | 'inconclusive'>
  hitDays: number
  daysMeasured: number
  windowRate: number
  baselineRate: number
}

/** Mínimo de días evaluables para arriesgar un veredicto (si no, inconclusa:
 *  honestidad sobre la muestra, no un juicio con 2 días). */
function minMeasured(durationDays: number): number {
  return Math.min(durationDays, Math.max(4, Math.ceil(durationDays / 2)))
}

/**
 * Mide el experimento: compara la tasa de la ventana contra la línea base y
 * decide el resultado. Sin muestra suficiente → inconclusa. `increase`/`decrease`
 * confirman si la métrica se movió ≥ RESULT_MARGIN en la dirección buscada;
 * `maintain` confirma si se sostuvo dentro del margen. Determinístico, sin IA.
 */
export function measureExperiment(
  plan: Pick<ExperimentPlan, 'metric' | 'direction' | 'durationDays'>,
  windowSignals: readonly DailySignals[],
  opts: { baselineRate: number; baselineDaysMeasured?: number } & MetricCtx,
): ExperimentMeasurement {
  const {
    hitDays,
    daysMeasured,
    rate: windowRate,
  } = computeMetricRate(plan.metric, windowSignals, opts)
  const baselineRate = opts.baselineRate
  const base = { hitDays, daysMeasured, windowRate, baselineRate }

  // Sin muestra en la ventana → inconclusa (no se juzga con 2 días).
  if (daysMeasured < minMeasured(plan.durationDays)) {
    return { ...base, status: 'inconclusive' }
  }
  // Sin línea base suficiente → inconclusa: comparar contra una base vacía haría
  // pasar "no había datos antes" por "mejoró" (bug #1).
  if (opts.baselineDaysMeasured != null && opts.baselineDaysMeasured < MIN_BASELINE_DAYS) {
    return { ...base, status: 'inconclusive' }
  }

  const delta = windowRate - baselineRate
  if (plan.direction === 'maintain') {
    return { ...base, status: Math.abs(delta) <= RESULT_MARGIN ? 'confirmed' : 'discarded' }
  }
  const effective = plan.direction === 'decrease' ? -delta : delta
  const status =
    effective >= RESULT_MARGIN
      ? 'confirmed'
      : effective <= -RESULT_MARGIN
        ? 'discarded'
        : 'inconclusive'
  return { ...base, status }
}
