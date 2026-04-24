import '@/global.css'

import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
  useFonts,
} from '@expo-google-fonts/fraunces'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { useThemeStore } from '@/design/theme'

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

  const ready = (fontsLoaded || fontError) && themeHydrated

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {})
  }, [ready])

  if (!ready) return null

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  )
}
