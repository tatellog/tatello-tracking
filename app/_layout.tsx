import '@/global.css'

import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts,
} from '@expo-google-fonts/inter'
import {
  InterTight_300Light,
  InterTight_400Regular,
  InterTight_500Medium,
} from '@expo-google-fonts/inter-tight'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { useProfile } from '@/features/profile/hooks'
import { useMagicLinkHandler } from '@/hooks/useMagicLinkHandler'
import { useSession } from '@/hooks/useSession'
import { ConfirmProvider } from '@/lib/confirm'
import { ensureDevUserSession } from '@/lib/devAuth'
import { clearVisitedDayOne, useVisitedDayOne } from '@/lib/onboardingFlags'
import {
  LAST_AUTH_USER_KEY,
  QUERY_CACHE_MAX_AGE,
  queryClient,
  queryPersister,
} from '@/lib/queryClient'

SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore — on fast refresh the splash is already hidden.
})

export default function RootLayout() {
  // Pearl Mauve sólo carga Inter + Inter Tight. Sin serif, sin italic.
  // Inter Tight para números display, Inter para todo el chrome UI.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    InterTight_300Light,
    InterTight_400Regular,
    InterTight_500Medium,
  })

  const { session, loading: sessionLoading } = useSession()

  useMagicLinkHandler()

  // Dev-only: si no hay sesión, loggear al user de prueba al arranque.
  // Corre una sola vez por mount; si ya hay sesión, es no-op.
  useEffect(() => {
    ensureDevUserSession().catch(() => {})
  }, [])

  // ── Cold-start cache flush ─────────────────────────────────────────
  // Query keys like ['profile', 'me'] don't include the auth user id,
  // and the cache is persisted to AsyncStorage. If a different user
  // signed in last time and their cache survived to this boot, the
  // persister hands their profile back to whoever signs in now —
  // RouteGuard reads the stale onboarding_completed_at and the new
  // user is dropped on Home instead of /onboarding/welcome.
  //
  // Fix: ONCE on cold start, compare the live session's user id to
  // the id we stored last boot. On mismatch, clear in-memory +
  // persisted caches before any query hook mounts. Render is gated
  // on `coldStartChecked` so RouteGuard never reads from a cache
  // that belongs to someone else.
  //
  // We deliberately do NOT re-gate render on subsequent sign-in /
  // sign-out transitions — Settings already clears caches on sign-
  // out, and tearing the navigator down mid-session was queuing
  // navigations against routes that didn't exist anymore.
  const [coldStartChecked, setColdStartChecked] = useState(false)
  useEffect(() => {
    if (sessionLoading) return
    if (coldStartChecked) return
    let cancelled = false
    ;(async () => {
      try {
        const stored = await AsyncStorage.getItem(LAST_AUTH_USER_KEY)
        if (cancelled) return
        const currentId = session?.user?.id ?? null
        if (stored && stored !== currentId) {
          queryClient.clear()
          await Promise.resolve(queryPersister.removeClient()).catch(() => {})
          await clearVisitedDayOne()
        }
      } catch {
        // AsyncStorage is best-effort — fall through to mark checked
        // so a transient storage hiccup can't soft-lock the splash.
      }
      if (!cancelled) setColdStartChecked(true)
    })()
    return () => {
      cancelled = true
    }
  }, [sessionLoading, session, coldStartChecked])

  // Keep the stored last-user-id in sync on every session change so
  // the next cold-start check has accurate info. This runs without
  // gating render — never blocks the UI.
  useEffect(() => {
    if (sessionLoading) return
    const id = session?.user?.id
    if (id) {
      AsyncStorage.setItem(LAST_AUTH_USER_KEY, id).catch(() => {})
    } else {
      AsyncStorage.removeItem(LAST_AUTH_USER_KEY).catch(() => {})
    }
  }, [sessionLoading, session?.user?.id])

  const ready = (fontsLoaded || fontError) && !sessionLoading && coldStartChecked

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {})
  }, [ready])

  if (!ready) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: QUERY_CACHE_MAX_AGE }}
      >
        <SafeAreaProvider>
          <ConfirmProvider>
            <RouteGuard />
            <Stack screenOptions={{ headerShown: false }}>
              {/* Slide-up sheet for logging a measurement. Other routes
                  inherit the default fullscreen push. */}
              <Stack.Screen name="log-measurement" options={{ presentation: 'modal' }} />
            </Stack>
          </ConfirmProvider>
        </SafeAreaProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  )
}

/*
 * Decides where the user belongs based on three pieces of state:
 *
 *   1. session — must exist (or skipAuth bypass) to render anything
 *      past /auth.
 *   2. profile.onboarding_completed_at — null while the user is
 *      mid-wizard. Without it set, anywhere outside /onboarding gets
 *      bounced to /onboarding/welcome.
 *   3. visitedDayOne (AsyncStorage) — once Día 1 has been cleared,
 *      the user lands on /(tabs) by default. Until then the Home is
 *      blocked behind the Día 1 ceremony so a kill-and-reopen can't
 *      skip it.
 *
 * Lives inside the QueryClient + SafeArea providers so it can use
 * useProfile. Renders nothing — it's purely a side-effect gate.
 */
function RouteGuard() {
  const { session } = useSession()
  const profileQuery = useProfile()
  const visitedDayOne = useVisitedDayOne()
  const segments = useSegments()
  const router = useRouter()

  // Dev escape hatch: with EXPO_PUBLIC_SKIP_AUTH=true in .env.local
  // the auth check is bypassed but onboarding/day-one gates still
  // apply (so dev users without a finished profile see the wizard).
  const skipAuth = process.env.EXPO_PUBLIC_SKIP_AUTH === 'true'

  useEffect(() => {
    const top = segments[0] ?? ''
    const inAuth = top === 'auth'
    const inOnboarding = top === 'onboarding'

    // ── Auth gate ──────────────────────────────────────────────────
    if (!skipAuth) {
      if (!session && !inAuth) {
        router.replace('/auth')
        return
      }
      if (session && inAuth) {
        router.replace('/(tabs)')
        return
      }
    }

    // No session and we're either on /auth or inside skipAuth-allowed
    // routes (skipAuth uses the dev session, but if it isn't set yet
    // there's nothing more to do this tick).
    if (!session) return

    // ── Onboarding gate ────────────────────────────────────────────
    // Wait for the profile to load before deciding — otherwise a
    // freshly-onboarded user gets bounced back to /welcome on the
    // first frame.
    if (profileQuery.isLoading || !profileQuery.data) return
    const onboardingDone = !!profileQuery.data.onboarding_completed_at

    if (!onboardingDone && !inOnboarding) {
      router.replace('/onboarding/welcome')
      return
    }

    // ── Día 1 gate ─────────────────────────────────────────────────
    // visitedDayOne === null means we haven't read AsyncStorage yet.
    if (visitedDayOne === null) return

    if (onboardingDone && !visitedDayOne && !inOnboarding) {
      router.replace('/onboarding/day-one')
      return
    }

    // Finished users who hit a wizard route by stale tab / bookmark
    // get pushed back to /(tabs) — re-running the wizard would
    // overwrite their profile data. The /onboarding/photos/* route
    // is intentionally exempted because the 30-day reminder banner
    // (Bloque G) deep-links there for re-takes.
    //
    // In dev (__DEV__), leave the routing alone so individual screens
    // can be opened by URL for QA without `pnpm seed:dev --fresh`.
    // segments is typed as a fixed-length tuple by expo-router's
    // typed-routes feature, so we cast to string[] for the depth-2
    // sniff. /onboarding/photos/* is the only nested wizard branch.
    const inPhotoWizard = inOnboarding && (segments as readonly string[])[1] === 'photos'
    if (!__DEV__ && onboardingDone && visitedDayOne && inOnboarding && !inPhotoWizard) {
      router.replace('/(tabs)')
      return
    }
  }, [
    session,
    profileQuery.isLoading,
    profileQuery.data,
    visitedDayOne,
    segments,
    router,
    skipAuth,
  ])

  return null
}
