import * as Linking from 'expo-linking'
import { useEffect } from 'react'

import { supabase } from '@/lib/supabase'

/*
 * Handles the tail end of the Supabase magic-link flow:
 *
 *   1. User requests a link from app/auth.tsx → Supabase sends an email.
 *   2. User taps the link → iOS / Android open tracking-app://auth/callback
 *      with access_token + refresh_token in the URL fragment.
 *   3. This hook intercepts that URL (both on cold start and while the app
 *      is already running), pulls the tokens out, and hands them to
 *      supabase.auth.setSession so useSession picks up the authenticated
 *      state and the root layout redirects into (tabs).
 *
 * The lib/supabase.ts client is configured with detectSessionInUrl: false
 * because that option is web-only; on native we parse manually here.
 */
export function useMagicLinkHandler() {
  useEffect(() => {
    let active = true

    const handleUrl = async (url: string | null) => {
      if (!active || !url) return
      const fragment = url.split('#')[1]
      if (!fragment) return
      const params = new URLSearchParams(fragment)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      if (!accessToken || !refreshToken) return
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
    }

    Linking.getInitialURL().then(handleUrl)
    const sub = Linking.addEventListener('url', (event) => handleUrl(event.url))

    return () => {
      active = false
      sub.remove()
    }
  }, [])
}
