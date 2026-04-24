import '@/global.css'

import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
  useFonts,
} from '@expo-google-fonts/fraunces'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { useThemeStore } from '@/design/theme'
import { useMagicLinkHandler } from '@/hooks/useMagicLinkHandler'
import { useSession } from '@/hooks/useSession'

SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore — on fast refresh the splash is already hidden.
})

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
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

  // Route guard: send unauthenticated users to /auth, and bounce
  // already-authenticated users off /auth back into the tabs. Gated
  // behind `ready` so we don't redirect during the initial hydration
  // flash (which would race against the splash screen).
  useEffect(() => {
    if (!ready) return
    const onAuthScreen = segments[0] === 'auth'
    if (!session && !onAuthScreen) {
      router.replace('/auth')
    } else if (session && onAuthScreen) {
      router.replace('/(tabs)')
    }
  }, [ready, session, segments, router])

  if (!ready) return null

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  )
}
