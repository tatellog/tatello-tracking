import { detectAbandonment, detectNightEating } from '@/features/patterns/logic'
import { PATTERN_MESSAGES } from '@/features/patterns/messages'
import { requireUserId, supabase } from '@/lib/supabase'

import { lastRevelationAt, shownTransformationKinds } from './api'
import { selectRevelation, type OrchestratorPattern, type PendingRevelation } from './logic'

/*
 * Detección (impura) — lee las señales del servidor y se las pasa al cerebro
 * puro (selectRevelation). Reúsa los detectores deterministas de
 * features/patterns (sin duplicar lógica). Las señales de PATRÓN nuevas
 * (proteína/entrenamiento/sueño) + el copy con conteos llegan en Stage C;
 * por ahora el único patrón es `night_eating` con su copy existente.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const WINDOW_DAYS = 14

type OpenRow = { created_at: string }
type MealRow = { consumed_at: string }

export async function detectPendingRevelation(args: {
  transformProgress: number
  signLabel: string
}): Promise<PendingRevelation | null> {
  const userId = await requireUserId()
  const nowMs = Date.now()
  const since = new Date(nowMs - WINDOW_DAYS * DAY_MS).toISOString()

  const [shownKinds, lastReturn, lastPattern, opensRes, mealsRes] = await Promise.all([
    shownTransformationKinds(),
    lastRevelationAt('return'),
    lastRevelationAt('pattern'),
    supabase
      .from('analytics_events')
      .select('created_at')
      .eq('user_id', userId)
      .eq('event_name', 'app_opened')
      .gte('created_at', since)
      .order('created_at', { ascending: true }),
    supabase
      .from('meals')
      .select('consumed_at')
      .eq('user_id', userId)
      .gte('consumed_at', since)
      .order('consumed_at', { ascending: true }),
  ])

  const openDays = [
    ...new Set(((opensRes.data ?? []) as OpenRow[]).map((r) => r.created_at.slice(0, 10))),
  ]
  const meals = (mealsRes.data ?? []) as MealRow[]

  const pattern: OrchestratorPattern | null = detectNightEating(meals)
    ? {
        kind: 'night_eating',
        message: PATTERN_MESSAGES.night_eating,
        // Historia = voz del sistema/Observadora, no del coach ("noté").
        title: 'Un patrón en tus noches.',
      }
    : null

  return selectRevelation({
    nowMs,
    transformProgress: args.transformProgress,
    shownTransformationKinds: shownKinds,
    signLabel: args.signLabel,
    returnSignal: detectAbandonment(openDays),
    lastReturnAtMs: lastReturn?.getTime() ?? null,
    pattern,
    lastPatternAtMs: lastPattern?.getTime() ?? null,
  })
}
