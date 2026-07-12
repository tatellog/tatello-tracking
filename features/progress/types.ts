/*
 * Progress · domain models (Epic 00 · Foundation).
 *
 * El HOGAR ÚNICO de los tipos de dominio de Progress. La UI y los hooks importan
 * desde aquí; nadie fuera de `api.ts` conoce la forma de Supabase (api.ts hace el
 * mapeo Supabase → dominio con Zod, la convención del repo). Los tipos vivos ya
 * existentes se RE-EXPORTAN (no se duplican); los contratos de las épicas 01-07
 * se declaran aquí como forward-contracts para que se construyan sin refactors.
 *
 * Convención del repo (frontend.md / CLAUDE.md): tipos inferidos de Zod
 * (`z.infer`), api.ts = borde Zod+Supabase (el "repository"), hooks.ts = acceso
 * de datos para la UI. Este archivo NO agrega una capa nueva: nombra la que ya
 * existe y le da un punto de entrada.
 */

// ── Modelos ya existentes (se re-exportan como dominio de Progress) ──────────
export type { BodyMeasurement } from '@/features/brief/api'
export type { BeforeAfter, NewMeasurementInput, ProgressPhoto, SleepEntry } from './api'
export type { Milestone } from './milestones'

// ── Forward-contracts (los llenan las épicas 01-07; ver docs/progress-3.0/) ──

/**
 * Epic 01 · Historia — comparación de un hábito entre dos ventanas (30 vs 30).
 * `direction` es sin color de culpa; el motor (logic.ts) lo calcula, la UI lo
 * pinta como hecho.
 */
export type MetricComparison = {
  key: 'workouts' | 'protein' | 'deficit' | 'logging' | 'weight'
  current: number
  previous: number
  delta: number
  direction: 'up' | 'down' | 'flat'
}

/** Epic 01 · Historia — el resumen de "cómo cambiaron mis hábitos". */
export type HistorySummary = {
  windowDays: number
  metrics: MetricComparison[]
}

/** Epic 02/03 · un corte del estado en un momento (para comparar en el tiempo). */
export type ProgressSnapshot = {
  date: string // YYYY-MM-DD
  weightKg: number | null
  bodyFatPct: number | null
  leanMassKg: number | null
}

/** Epic 02 · Body — dos fechas de foto comparadas (un ángulo). */
export type PhotoComparison = {
  angle: 'front' | 'back' | 'left' | 'right'
  a: { date: string; url: string | null } | null
  b: { date: string; url: string | null } | null
}

/** Contexto de ciclo (se mantiene; Progress no lo rediseña · manifiesto). */
export type CycleSummary = {
  lastPeriodStart: string | null
}

/**
 * Epic 03 · Progress Insight Engine — un cambio importante detectado, TODO
 * determinístico (sin IA). Espeja el `Finding` de Órbita para poder reutilizar el
 * chat guiado (Epic 04) y la metacognición (Epic 05). Responde QUÉ cambió, nunca
 * por qué (eso es Órbita).
 */
export type ProgressInsight = {
  id: string
  subject: string
  lead: string // la lectura en voz del coach (QUÉ cambió)
  support: string // la evidencia con números (del motor, NUNCA de IA)
  contrast: string | null // el otro lado ("...mientras tu peso se mantuvo")
  confidence: number // 0-100
  relatedMetrics: string[] // ['weight','body_fat'] para enlazar cards
  northLink: string | null // conexión con el objetivo (opcional)
}

// ── Estado compartido de pantalla (Epic 00) ─────────────────────────────────

/**
 * El estado que TODA superficie de Progress consume. Union discriminada para que
 * la UI no tenga que combinar `isLoading`/`data`/`error` a mano en cada pantalla.
 * `partial` = hay algo que mostrar pero incompleto (p. ej. sin fotos aún);
 * `completed` = data suficiente. La distinción la decide cada hook con su
 * predicado de "vacío/parcial".
 */
export type ProgressState<T> =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'partial'; data: T }
  | { status: 'completed'; data: T }
  | { status: 'error'; error: unknown }

/**
 * Deriva un `ProgressState<T>` desde el resultado de una query de React Query +
 * un predicado de vacío. Mantiene la lógica de estados fuera de los componentes
 * (Epic 00: "nada de lógica en la pantalla").
 */
export function toProgressState<T>(
  q: { isPending: boolean; isError: boolean; error: unknown; data: T | undefined },
  isEmpty: (data: T) => boolean,
  isPartial: (data: T) => boolean = () => false,
): ProgressState<T> {
  if (q.isError) return { status: 'error', error: q.error }
  if (q.isPending || q.data === undefined) return { status: 'loading' }
  if (isEmpty(q.data)) return { status: 'empty' }
  if (isPartial(q.data)) return { status: 'partial', data: q.data }
  return { status: 'completed', data: q.data }
}
