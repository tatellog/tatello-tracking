import type { Session, User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'

type SessionState = {
  session: Session | null
  user: User | null
  loading: boolean
}

/*
 * Tracks the Supabase auth session. On mount we fetch whatever is
 * persisted in storage (the fast path — avoids a network roundtrip)
 * and then subscribe to onAuthStateChange so token refreshes,
 * sign-ins, and sign-outs keep the returned state in sync.
 *
 * `loading` is true only until the first session read completes.
 * After that it stays false even across session changes, so callers
 * can use it as a one-shot gate without having to distinguish "we
 * haven't checked yet" from "we have checked and there's no user".
 */
export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      setSession(next)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return { session, user: session?.user ?? null, loading }
}
