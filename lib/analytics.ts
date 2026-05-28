import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database.types'

/*
 * Beta analytics tracker — fire-and-forget inserts into
 * public.analytics_events. Gated on profiles.is_beta so non-beta
 * users don't pollute the table with traffic we won't analyse.
 *
 * track() must NEVER throw or block the UI. Every failure path
 * (no session, RLS reject, network down, schema drift) is
 * swallowed silently. The is_beta flag is cached per user so we
 * hit the profiles table once per session, not once per event.
 */

type BetaCache = { userId: string; isBeta: boolean }
let betaCache: BetaCache | null = null

async function shouldTrack(userId: string): Promise<boolean> {
  if (betaCache && betaCache.userId === userId) return betaCache.isBeta
  try {
    const { data } = await supabase
      .from('profiles')
      .select('is_beta')
      .eq('id', userId)
      .maybeSingle()
    const isBeta = data?.is_beta === true
    betaCache = { userId, isBeta }
    return isBeta
  } catch {
    return false
  }
}

export function track(eventName: string, metadata?: Record<string, unknown>): void {
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession()
      const userId = data.session?.user?.id
      if (!userId) return
      if (!(await shouldTrack(userId))) return
      await supabase.from('analytics_events').insert({
        user_id: userId,
        event_name: eventName,
        metadata: (metadata ?? {}) as Json,
      })
    } catch {
      // Analytics must never crash the app.
    }
  })()
}

/** Drop the cached is_beta flag — call on sign-out so the next
 *  user's value is re-fetched from profiles. */
export function clearAnalyticsCache(): void {
  betaCache = null
}
