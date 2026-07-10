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
import type { Finding, FindingCategory, Hypothesis } from './engine'

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
