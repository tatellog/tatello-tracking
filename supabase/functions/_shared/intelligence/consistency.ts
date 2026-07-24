/*
 * Consistency detectors — pure functions. No DB, no React, no global
 * `new Date()`; `nowMs` enters as a parameter so the same input always
 * yields the same output (deterministic).
 *
 * These observe REPEATED positive behaviour over the last 7 days and
 * return evidence WITH A COUNT (owner-approved: e.g. "en 5 de los
 * últimos 7 días"). `count` is the number of DISTINCT days that meet
 * the criterion inside the window — it feeds the count-based copy.
 *
 * Empathy guard: these describe behaviour, not verdict. No clinical
 * vocabulary, no judgement — they recognise constancy, they don't grade.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Analysis window shared by every consistency detector. */
export const WINDOW_DAYS = 7

/** Protein: a day counts when the target was met. */
export const PROTEIN_CONSISTENT_MIN_DAYS = 4

/** Training: a day counts when the user trained. */
export const TRAINING_CONSISTENT_MIN_DAYS = 3

/** Sleep: a night counts when it reached this many minutes (6.5h). NOT 7h —
 *  behavioral-specialist: el 7h binario casi nunca dispara y el copy promete
 *  "estabilidad", no estándar médico. 6.5h hace el patrón alcanzable. */
export const SLEEP_ENOUGH_MIN = 390

/** Sleep: nights of enough sleep needed to fire. */
export const SLEEP_CONSISTENT_MIN_DAYS = 4

/** Shared result shape. `count` = distinct in-window days that qualify. */
export type ConsistencyResult = {
  detected: boolean
  count: number
  windowDays: number
}

export type ProteinDay = {
  /** YYYY-MM-DD, local day. */
  date: string
  proteinG: number
  targetG: number
}

export type SleepNight = {
  /** YYYY-MM-DD, local day. */
  date: string
  minutes: number
}

/**
 * Local YYYY-MM-DD for an instant. Used to derive the window's lower
 * bound so dedup and membership compare like-for-like (date strings).
 */
function localDateKey(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/* La MISMA lógica sirve para la ventana semanal (reveal de Hoy, default 7 días)
 * y para la mensual (Órbita Mes, ~31 días con su propio umbral): `opts` deja
 * pasar `windowDays` + `minDays` sin romper a quien llama con la firma de 2
 * args (revelations/detect.ts y los tests semanales). */
export type ConsistencyOpts = { windowDays?: number; minDays?: number }

/**
 * The earliest date string still inside the window: today's local date
 * minus (windowDays - 1) days, so the window spans `windowDays` calendar
 * days ending today (inclusive). Comparison is lexical, valid for YYYY-MM-DD.
 */
function windowStartKey(nowMs: number, windowDays: number): string {
  return localDateKey(nowMs - (windowDays - 1) * DAY_MS)
}

/** True when `date` (YYYY-MM-DD) falls within [start, today]. */
function inWindow(date: string, startKey: string, todayKey: string): boolean {
  return date >= startKey && date <= todayKey
}

/**
 * Counts distinct in-window dates whose entry passes `qualifies`.
 * Dedups by date: a date already counted is skipped, so duplicate
 * entries for the same day never inflate the count.
 */
function countQualifyingDays<T extends { date: string }>(
  entries: readonly T[],
  nowMs: number,
  windowDays: number,
  qualifies: (entry: T) => boolean,
): number {
  const startKey = windowStartKey(nowMs, windowDays)
  const todayKey = localDateKey(nowMs)
  const counted = new Set<string>()
  for (const entry of entries) {
    if (counted.has(entry.date)) continue
    if (!inWindow(entry.date, startKey, todayKey)) continue
    if (qualifies(entry)) counted.add(entry.date)
  }
  return counted.size
}

/** Days where protein reached its target inside the window. */
export function detectProteinConsistency(
  days: readonly ProteinDay[],
  nowMs: number,
  opts?: ConsistencyOpts,
): ConsistencyResult {
  const windowDays = opts?.windowDays ?? WINDOW_DAYS
  const min = opts?.minDays ?? PROTEIN_CONSISTENT_MIN_DAYS
  const count = countQualifyingDays(
    days,
    nowMs,
    windowDays,
    (d) => d.targetG > 0 && d.proteinG >= d.targetG,
  )
  return { detected: count >= min, count, windowDays }
}

/** Distinct training days inside the window. */
export function detectTrainingConsistency(
  workoutDates: readonly string[],
  nowMs: number,
  opts?: ConsistencyOpts,
): ConsistencyResult {
  const windowDays = opts?.windowDays ?? WINDOW_DAYS
  const min = opts?.minDays ?? TRAINING_CONSISTENT_MIN_DAYS
  const count = countQualifyingDays(
    workoutDates.map((date) => ({ date })),
    nowMs,
    windowDays,
    () => true,
  )
  return { detected: count >= min, count, windowDays }
}

/** Nights with enough sleep (≥ SLEEP_ENOUGH_MIN) inside the window. */
export function detectSleepConsistency(
  nights: readonly SleepNight[],
  nowMs: number,
  opts?: ConsistencyOpts,
): ConsistencyResult {
  const windowDays = opts?.windowDays ?? WINDOW_DAYS
  const min = opts?.minDays ?? SLEEP_CONSISTENT_MIN_DAYS
  const count = countQualifyingDays(nights, nowMs, windowDays, (n) => n.minutes >= SLEEP_ENOUGH_MIN)
  return { detected: count >= min, count, windowDays }
}
