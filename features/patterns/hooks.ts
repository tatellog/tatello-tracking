import { useEffect, useState } from 'react'

import { requireUserId, supabase } from '@/lib/supabase'

import { detectAbandonment, detectNightEating, type PatternType } from './logic'
import { PATTERN_MESSAGES } from './messages'

/*
 * Pattern detection hook — runs once on mount (Hoy tab). Pulls
 * 14 days of meals + `app_opened` events, runs the detectors,
 * and (if any fire) inserts a `detected_patterns` row + returns
 * the card data.
 *
 * Rate limit: at most ONE full-screen reveal per ~7 days. The
 * reveal takes the whole screen, so it must be scarce and earned —
 * a constant stream would feel like surveillance, not care
 * (manifiesto). If any pattern was surfaced in the last 7 days the
 * hook bails; a fresh finding stays silent until the window opens.
 *
 * Failures are swallowed (returns { pattern: null }). The coach
 * surface is product polish, not critical data: it must never
 * block the home from rendering.
 */
type DetectedPattern = { id: string; type: PatternType; message: string }

export function usePatternDetection() {
  const [pattern, setPattern] = useState<DetectedPattern | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const userId = await requireUserId()

        // Surfaced a reveal in the last 7 days? Bail — the full-screen
        // moment is scarce on purpose. A new finding waits its turn.
        const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        const { data: recentRow } = await supabase
          .from('detected_patterns')
          .select('id')
          .eq('user_id', userId)
          .gte('detected_at', windowStart.toISOString())
          .limit(1)
          .maybeSingle()
        if (cancelled || recentRow) return

        const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
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
        if (cancelled) return

        const meals = (mealsResult.data ?? []) as { consumed_at: string }[]
        const openDays = [
          ...new Set(
            ((opensResult.data ?? []) as { created_at: string }[]).map((r) =>
              r.created_at.slice(0, 10),
            ),
          ),
        ]

        // Priority: abandonment first (a returning user gets the
        // warm welcome before any other observation), then night
        // eating. Mutually exclusive within a single day.
        let detected: PatternType | null = null
        if (detectAbandonment(openDays)) detected = 'abandonment'
        else if (detectNightEating(meals)) detected = 'night_eating'
        if (!detected) return

        const { data: inserted } = await supabase
          .from('detected_patterns')
          .insert({ user_id: userId, pattern_type: detected })
          .select('id')
          .single()
        if (cancelled || !inserted) return

        setPattern({
          id: inserted.id,
          type: detected,
          message: PATTERN_MESSAGES[detected],
        })
      } catch {
        // Pattern detection must never break the home.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const dismiss = () => {
    if (!pattern) return
    const { id } = pattern
    setPattern(null)
    // Mark as shown — fire-and-forget; the local dismiss is
    // immediate regardless of network outcome.
    void supabase.from('detected_patterns').update({ shown_to_user: true }).eq('id', id)
  }

  return { pattern, dismiss }
}
