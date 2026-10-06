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
  /** Duración en días. ≤14 (≤2 semanas · regla del PRD); un plan de un día
   *  de la semana llega a 28 (dueña 6 oct 2026: con 2 viernes no se mide). */
  durationDays: number
  /** Plan de UN día de la semana (0 = domingo … 6 = sábado, como getUTCDay):
   *  la ventana y la línea base miden solo ese día ("tus viernes"). */
  weekday?: number
  /** El plan en palabras de ella ("Entrenar ese día"), elegido o escrito. */
  planText?: string
  /** Hora del recordatorio ese día, en minutos desde medianoche (780 = 13:00). */
  reminderMinutes?: number
}

/** Duración por defecto (2 semanas · el máximo permitido). */
export const DEFAULT_DURATION_DAYS = 14
/** Tope duro del PRD: nunca más de 2 semanas. */
export const MAX_DURATION_DAYS = 14
/** Plan de un día de la semana: 4 semanas = 4 ocurrencias de ese día. */
export const WEEKDAY_PLAN_DAYS = 28

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
  opts: {
    durationDays?: number
    weekday?: number
    planText?: string
    reminderMinutes?: number
  } = {},
): ExperimentPlan | null {
  // La hipótesis debe venir del Finding que se pasa (integridad del par).
  if (hypothesis.sourceFindingId && hypothesis.sourceFindingId !== sourceFinding.id) return null
  const metric = METRIC_BY_DIMENSION[sourceFinding.category]
  if (!metric) return null

  const weekdayPlan = opts.weekday != null
  if (weekdayPlan && !isWeekday(opts.weekday)) return null
  const durationDays = weekdayPlan
    ? clampDuration(opts.durationDays ?? WEEKDAY_PLAN_DAYS, WEEKDAY_PLAN_DAYS)
    : clampDuration(opts.durationDays ?? DEFAULT_DURATION_DAYS)
  if (durationDays < 1) return null

  const plan: ExperimentPlan = {
    dimension: sourceFinding.category,
    metric,
    direction: 'increase',
    durationDays,
  }
  if (weekdayPlan) {
    plan.weekday = opts.weekday
    const text = opts.planText?.trim().slice(0, PLAN_TEXT_MAX)
    if (text) plan.planText = text
    if (isReminderMinutes(opts.reminderMinutes)) plan.reminderMinutes = opts.reminderMinutes
  }
  return plan
}

/** Largo máximo del plan escrito por ella (cabe en una notificación). */
export const PLAN_TEXT_MAX = 80

function isWeekday(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 6
}

function isReminderMinutes(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= 0 && (n as number) < 24 * 60
}

/** Día de la semana de un 'YYYY-MM-DD' (0 = domingo), sin zona horaria. */
export function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay()
}

/** Solo los días de ese día de la semana (la ventana o la base de un plan). */
export function onlyWeekday<T extends { day: string | null }>(
  rows: readonly T[],
  weekday: number,
): T[] {
  return rows.filter((r) => r.day != null && weekdayOf(r.day) === weekday)
}

/** Acota la duración al rango [1, max] (por defecto 2 semanas). Enteriza. */
export function clampDuration(days: number, max: number = MAX_DURATION_DAYS): number {
  if (!Number.isFinite(days)) return 0
  return Math.max(1, Math.min(max, Math.floor(days)))
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
/** Plan de un día de la semana: muestra mínima en la ventana (3 de sus 4
 *  viernes) y en la base (3 viernes previos). Con menos, inconclusa. */
export const MIN_WEEKDAY_SAMPLES = 3
/** Línea base de un plan de día: ese día en las 8 semanas previas. */
export const WEEKDAY_BASELINE_DAYS = 56
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
  plan: Pick<ExperimentPlan, 'metric' | 'direction' | 'durationDays' | 'weekday'>,
  windowSignals: readonly DailySignals[],
  opts: { baselineRate: number; baselineDaysMeasured?: number } & MetricCtx,
): ExperimentMeasurement {
  // Plan de un día: solo cuentan ESOS días de la ventana (los demás días no
  // eran parte del plan).
  const weekdayPlan = plan.weekday != null
  const scoped = weekdayPlan ? onlyWeekday(windowSignals, plan.weekday!) : windowSignals
  const { hitDays, daysMeasured, rate: windowRate } = computeMetricRate(plan.metric, scoped, opts)
  const baselineRate = opts.baselineRate
  const base = { hitDays, daysMeasured, windowRate, baselineRate }

  // Sin muestra en la ventana → inconclusa (no se juzga con 2 días).
  const minWindow = weekdayPlan ? MIN_WEEKDAY_SAMPLES : minMeasured(plan.durationDays)
  if (daysMeasured < minWindow) {
    return { ...base, status: 'inconclusive' }
  }
  // Sin línea base suficiente → inconclusa: comparar contra una base vacía haría
  // pasar "no había datos antes" por "mejoró" (bug #1).
  const minBase = weekdayPlan ? MIN_WEEKDAY_SAMPLES : MIN_BASELINE_DAYS
  if (opts.baselineDaysMeasured != null && opts.baselineDaysMeasured < minBase) {
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

/* ── Plan de un día de la semana · las opciones salen de SUS días buenos ────
 *
 * Un plan "si es viernes, haré X" (Gollwitzer & Sheeran 2006). Stelar no
 * receta: muestra lo que estuvo presente en SUS viernes que sí quedaron en
 * déficit y no en los otros. Solo hábitos que el motor ya mide; nada de comida.
 */

export type PlanOptionKey = 'trained' | 'sleep' | 'protein' | 'water'

export type PlanOption = {
  key: PlanOptionKey
  /** El plan en su voz, listo para guardarse como planText. */
  text: string
  /** La evidencia: "En 3 de tus 4 viernes en déficit". */
  evidence: string
  /** Días buenos con el hábito / días buenos (para ordenar). */
  goodShare: number
}

const PLAN_OPTION_TEXT: Record<PlanOptionKey, string> = {
  trained: 'Entrenar ese día',
  sleep: 'Dormir 7 h la noche antes',
  protein: 'Llegar a mi proteína',
  water: 'Completar mi agua',
}

const PLAN_HABIT: Record<PlanOptionKey, (s: DailySignals, c: MetricCtx) => boolean> = {
  trained: (s) => s.trained === true,
  sleep: (s) => (s.sleep_minutes ?? 0) >= SLEEP_7H_MIN,
  protein: (s, c) => c.proteinTarget != null && (s.protein_g ?? 0) >= c.proteinTarget,
  water: (s) => (s.water_glasses ?? 0) >= WATER_GOAL_GLASSES,
}

/**
 * Las opciones de plan para un día de la semana, desde sus propios datos: un
 * hábito entra si estuvo en al menos la mitad de sus días buenos (en déficit) de
 * ese día Y más seguido que en los malos. Ordenadas por presencia en los buenos.
 * Sin al menos 2 días buenos de ese día, no hay evidencia: devuelve [].
 */
export function planOptionsForWeekday(
  signals: readonly DailySignals[],
  weekday: number,
  ctx: MetricCtx,
  weekdayLabel: string,
): PlanOption[] {
  if (ctx.calorieTarget == null) return []
  const days = onlyWeekday(signals, weekday).filter((s) => s.calories != null && s.calories > 0)
  const good = days.filter((s) => isDeficitDay(s.calories, ctx.calorieTarget))
  const bad = days.filter((s) => !isDeficitDay(s.calories, ctx.calorieTarget))
  if (good.length < 2) return []
  const out: PlanOption[] = []
  for (const key of Object.keys(PLAN_HABIT) as PlanOptionKey[]) {
    const has = PLAN_HABIT[key]
    const g = good.filter((s) => has(s, ctx)).length
    const goodShare = g / good.length
    const badShare = bad.length > 0 ? bad.filter((s) => has(s, ctx)).length / bad.length : 0
    if (goodShare < 0.5 || goodShare <= badShare) continue
    out.push({
      key,
      text: PLAN_OPTION_TEXT[key],
      evidence: `En ${g} de tus ${good.length} ${weekdayLabel} en déficit`,
      goodShare,
    })
  }
  return out.sort((a, b) => b.goodShare - a.goodShare)
}
