import { useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'
import { requireUserId, supabase } from '@/lib/supabase'

import { detectAbandonment, detectNightEating, type PatternType } from './logic'
import { PATTERN_MESSAGES } from './messages'

/*
 * Pattern detection — runs the detectors over 14 days of meals +
 * `app_opened` events and (if any fire) inserts a `detected_patterns`
 * row + returns the card data.
 *
 * Rate limit: at most ONE full-screen reveal per ~7 days. The reveal
 * takes the whole screen, so it must be scarce and earned — a constant
 * stream would feel like surveillance, not care (manifiesto). The DB
 * row is the source of truth for the window; if any pattern surfaced in
 * the last 7 days the detector bails.
 *
 * Cached in React Query (queryKeys.patterns.detection) so it does NOT
 * re-run the detectors + inserts on every focus of Hoy — the previous
 * useEffect fired a fresh batch of Supabase reads on each remount/focus.
 * staleTime = the 7-day window, and refetchOnMount/Focus are off, so the
 * detection runs once and rests until the window can reopen. Errors are
 * captured by the query (never thrown to render) so they can never block
 * the home — the consumer reads `pattern` and ignores the error state.
 */
type DetectedPattern = { id: string; type: PatternType; message: string }

const REVEAL_WINDOW_DAYS = 7
const REVEAL_WINDOW_MS = REVEAL_WINDOW_DAYS * 24 * 60 * 60 * 1000
const ANALYSIS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

async function detectPattern(): Promise<DetectedPattern | null> {
  const userId = await requireUserId()

  // Surfaced a reveal in the last 7 days? Bail — the full-screen
  // moment is scarce on purpose. A new finding waits its turn.
  const windowStart = new Date(Date.now() - REVEAL_WINDOW_MS)
  const { data: recentRow } = await supabase
    .from('detected_patterns')
    .select('id')
    .eq('user_id', userId)
    .gte('detected_at', windowStart.toISOString())
    .limit(1)
    .maybeSingle()
  if (recentRow) return null

  const since = new Date(Date.now() - ANALYSIS_WINDOW_MS).toISOString()
  const [mealsResult, opensResult] = await Promise.all([
    supabase
      .from('meals')
      .select('consumed_at')
      .eq('user_id', userId)
      .gte('consumed_at', since)
      .order('consumed_at', { ascending: true }),
    supabase
      .from('analytics_events')
      .select('created_at')
      .eq('user_id', userId)
      .eq('event_name', 'app_opened')
      .gte('created_at', since)
      .order('created_at', { ascending: true }),
  ])

  const meals = (mealsResult.data ?? []) as { consumed_at: string }[]
  const openDays = [
    ...new Set(
      ((opensResult.data ?? []) as { created_at: string }[]).map((r) => r.created_at.slice(0, 10)),
    ),
  ]

  // Priority: abandonment first (a returning user gets the warm
  // welcome before any other observation), then night eating.
  // Mutually exclusive within a single day.
  let detected: PatternType | null = null
  if (detectAbandonment(openDays)) detected = 'abandonment'
  else if (detectNightEating(meals)) detected = 'night_eating'
  if (!detected) return null

  const { data: inserted } = await supabase
    .from('detected_patterns')
    .insert({ user_id: userId, pattern_type: detected })
    .select('id')
    .single()
  if (!inserted) return null

  return { id: inserted.id, type: detected, message: PATTERN_MESSAGES[detected] }
}

export function usePatternDetection() {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: queryKeys.patterns.detection(),
    queryFn: detectPattern,
    // The 7-day reveal window IS the cadence — keep the result fresh for
    // that long so neither a remount nor a tab focus re-runs detection.
    staleTime: REVEAL_WINDOW_MS,
    gcTime: REVEAL_WINDOW_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    // A transient network error shouldn't silently swallow a real reveal.
    retry: 2,
  })
  const pattern = data ?? null

  const dismiss = () => {
    if (!pattern) return
    const { id } = pattern
    // Clear locally without a refetch (the query stays fresh for the
    // 7-day window, so it won't re-run and re-surface the same card).
    qc.setQueryData(queryKeys.patterns.detection(), null)
    // Mark as shown — fire-and-forget; the local dismiss is immediate
    // regardless of network outcome.
    void supabase.from('detected_patterns').update({ shown_to_user: true }).eq('id', id)
  }

  return { pattern, dismiss }
}
