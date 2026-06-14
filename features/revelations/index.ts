/*
 * Sistema de Revelaciones — momentos escasos y narrativos (no recompensas).
 * Tres tiers: Transformación (25/50/75/100), Regreso (3+ días), Patrones
 * (1/7d). Spec: docs/revelations-system-spec.md.
 *
 * Stage A (cimientos): capa de datos + Historia. El orquestador y las
 * ceremonias full-screen llegan en stages siguientes.
 */
export {
  lastRevelationAt,
  listRevelations,
  markRevelationDismissed,
  recordRevelation,
  REVELATION_TIERS,
  revelationRowSchema,
  shownTransformationKinds,
  type RecordRevelationInput,
  type RevelationRow,
  type RevelationTier,
} from './api'
export { useRevelationHistory, useRevelationOrchestrator } from './hooks'
export {
  PATTERN_RATE_LIMIT_MS,
  selectRevelation,
  TRANSFORMATION_THRESHOLDS,
  transformationCopy,
  type OrchestratorInput,
  type PendingRevelation,
} from './logic'
export { TransformationReveal } from './components/TransformationReveal'
