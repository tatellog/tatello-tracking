import {
  detectProteinConsistency,
  detectSleepConsistency,
  detectTrainingConsistency,
  type ConsistencyResult,
} from '@/features/patterns/consistency'
import {
  detectAbandonment,
  detectNightEating,
  nightEatingDayCount,
} from '@/features/patterns/logic'
import { requireUserId, supabase } from '@/lib/supabase'

import { lastRevelationAt, shownTransformationKinds } from './api'
import {
  patternRevelationCopy,
  selectRevelation,
  type OrchestratorPattern,
  type PendingRevelation,
} from './logic'
import { fetchPatternData } from './pattern-data'

/*
 * Detección (impura) — lee las señales del servidor y se las pasa al cerebro
 * puro (selectRevelation). Reúsa los detectores deterministas de
 * features/patterns + consistency (sin duplicar lógica). El copy de patrón
 * (con conteos) lo arma patternRevelationCopy.
 *
 * Prioridad entre patrones (behavioral, spec Decisión #5): los POSITIVOS
 * ganan al noticing — entreno > proteína > sueño; la comida nocturna solo
 * emerge si NO hay ningún positivo, y con cadencia propia ≥ 14 días.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const NOTICING_CADENCE_MS = 14 * DAY_MS

type OpenRow = { created_at: string }

/** Último reveal de comida nocturna (cadencia propia del noticing). */
async function lastNightEatingAt(): Promise<Date | null> {
  const { data, error } = await supabase
    .from('revelations')
    .select('shown_at')
    .eq('kind', 'night_eating')
    .order('shown_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.shown_at ? new Date(data.shown_at) : null
}

function buildPattern(kind: string, result: ConsistencyResult): OrchestratorPattern {
  const copy = patternRevelationCopy(kind, result.count, result.windowDays)
  return {
    kind,
    message: copy.message,
    title: copy.title,
    metadata: { count: result.count, window_days: result.windowDays },
  }
}

/**
 * Elige UN patrón (o null). Positivos primero (entreno > proteína > sueño);
 * el noticing solo si no hay positivo y pasó su cadencia de 14 días.
 */
function pickPattern(
  data: Awaited<ReturnType<typeof fetchPatternData>>,
  nowMs: number,
  lastNightAtMs: number | null,
): OrchestratorPattern | null {
  const now = new Date(nowMs)

  const training = detectTrainingConsistency(data.workoutDates, nowMs)
  if (training.detected) return buildPattern('training_consistent', training)

  const protein = detectProteinConsistency(data.proteinDays, nowMs)
  if (protein.detected) return buildPattern('protein_consistent', protein)

  const sleep = detectSleepConsistency(data.sleepNights, nowMs)
  if (sleep.detected) return buildPattern('sleep_consistent', sleep)

  // Noticing — solo en ausencia de positivo, con cadencia propia ≥ 14 días.
  if (
    detectNightEating(data.meals, now) &&
    (lastNightAtMs == null || nowMs - lastNightAtMs >= NOTICING_CADENCE_MS)
  ) {
    const count = nightEatingDayCount(data.meals, now)
    return buildPattern('night_eating', { detected: true, count, windowDays: 7 })
  }

  return null
}

export async function detectPendingRevelation(args: {
  transformProgress: number
  signLabel: string
}): Promise<PendingRevelation | null> {
  const userId = await requireUserId()
  const nowMs = Date.now()
  const since = new Date(nowMs - NOTICING_CADENCE_MS).toISOString()

  const [shownKinds, lastReturn, lastPattern, lastNight, opensRes, data] = await Promise.all([
    shownTransformationKinds(),
    lastRevelationAt('return'),
    lastRevelationAt('pattern'),
    lastNightEatingAt(),
    supabase
      .from('analytics_events')
      .select('created_at')
      .eq('user_id', userId)
      .eq('event_name', 'app_opened')
      .gte('created_at', since)
      .order('created_at', { ascending: true }),
    fetchPatternData(nowMs),
  ])

  const openDays = [
    ...new Set(((opensRes.data ?? []) as OpenRow[]).map((r) => r.created_at.slice(0, 10))),
  ]

  return selectRevelation({
    nowMs,
    transformProgress: args.transformProgress,
    shownTransformationKinds: shownKinds,
    signLabel: args.signLabel,
    returnSignal: detectAbandonment(openDays),
    lastReturnAtMs: lastReturn?.getTime() ?? null,
    pattern: pickPattern(data, nowMs, lastNight?.getTime() ?? null),
    lastPatternAtMs: lastPattern?.getTime() ?? null,
  })
}
