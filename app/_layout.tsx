import '@/global.css'

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
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { useMagicLinkHandler } from '@/hooks/useMagicLinkHandler'
import { useSession } from '@/hooks/useSession'
import { ensureDevUserSession } from '@/lib/devAuth'
import { QUERY_CACHE_MAX_AGE, queryClient, queryPersister } from '@/lib/queryClient'

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
  const segments = useSegments()
  const router = useRouter()

  useMagicLinkHandler()

  // Dev-only: si no hay sesión, loggear al user de prueba al arranque.
  // Corre una sola vez por mount; si ya hay sesión, es no-op.
  useEffect(() => {
    ensureDevUserSession().catch(() => {})
  }, [])

  const ready = (fontsLoaded || fontError) && !sessionLoading

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {})
  }, [ready])

  // Dev escape hatch: with EXPO_PUBLIC_SKIP_AUTH=true in .env.local
  // the app boots straight into (tabs) for UI iteration against mock
  // data. The variable must be unset in any real build.
  const skipAuth = process.env.EXPO_PUBLIC_SKIP_AUTH === 'true'

  // Route guard: send unauthenticated users to /auth, and bounce
  // already-authenticated users off /auth back into the tabs. Gated
  // behind `ready` so we don't redirect mid-hydration (which would
  // race against the splash screen handoff).
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
