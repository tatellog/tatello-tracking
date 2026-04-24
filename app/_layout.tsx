import '@/global.css'

import {
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
} from '@expo-google-fonts/cormorant-garamond'
import { EBGaramond_400Regular_Italic } from '@expo-google-fonts/eb-garamond'
import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
  useFonts,
} from '@expo-google-fonts/fraunces'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { useThemeStore } from '@/design/theme'
import { useMagicLinkHandler } from '@/hooks/useMagicLinkHandler'
import { useSession } from '@/hooks/useSession'
import { QUERY_CACHE_MAX_AGE, queryClient, queryPersister } from '@/lib/queryClient'

SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore — on fast refresh the splash is already hidden.
})

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    // Sprint 2 display + prose — consumed by /theme/typography.ts
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
    EBGaramond_400Regular_Italic,
    // Legacy /design/ family — kept until that folder is fully retired.
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
  })

  const [themeHydrated, setThemeHydrated] = useState(() => useThemeStore.persist.hasHydrated())

  useEffect(() => {
    if (themeHydrated) return
    const unsub = useThemeStore.persist.onFinishHydration(() => setThemeHydrated(true))
    return unsub
  }, [themeHydrated])

  const { session, loading: sessionLoading } = useSession()
  const segments = useSegments()
  const router = useRouter()

  useMagicLinkHandler()

  const ready = (fontsLoaded || fontError) && themeHydrated && !sessionLoading

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {})
  }, [ready])

  // Dev escape hatch: with EXPO_PUBLIC_SKIP_AUTH=true in .env.local
  // the app boots straight into (tabs) for UI iteration against mock
  // data. The variable must be unset in any real build.
  const skipAuth = process.env.EXPO_PUBLIC_SKIP_AUTH === 'true'

  // Route guard: send unauthenticated users to /auth, and bounce
  // already-authenticated users off /auth back into the tabs. Gated
  // behind `ready` so we don't redirect during the initial hydration
  // flash (which would race against the splash screen).
  useEffect(() => {
    if (!ready || skipAuth) return
    const onAuthScreen = segments[0] === 'auth'
    if (!session && !onAuthScreen) {
      router.replace('/auth')
    } else if (session && onAuthScreen) {
      router.replace('/(tabs)')
    }
  }, [ready, session, segments, router, skipAuth])

  if (!ready) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: QUERY_CACHE_MAX_AGE }}
      >
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </SafeAreaProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  )
}
