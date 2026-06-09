import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

import {
  DaySegment,
  MonthSegment,
  OrbitSegments,
  ScreenCosmos,
  WeekSegment,
  type OrbitSegment,
} from '@/features/orbit/components'
import { consumeOrbitSegment } from '@/features/orbit/pending-segment'
import { ScrollPauseContext } from '@/features/orbit/useScreenActive'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadingView } from '@/components/LoadingView'
import { SkyBackground, TabHeader } from '@/features/tabs/components'
import { track } from '@/lib/analytics'
import { colors } from '@/theme'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

/*
 * Tu Órbita — STELAR's core tab, the meaning layer. Three time
 * altitudes of one sky: Día (El Sistema) · Semana (Las Órbitas) ·
 * Mes (El Cielo). See docs/tu-orbita-design.md.
 *
 * Día renders the live orbital diagram. The engine-fed pieces (Voz de
 * Stelar, patrones) currently run on MOCK data — see features/orbit/
 * mock.ts — until the Anthropic key is in.
 */
export default function OrbitScreen() {
  return (
    <ErrorBoundary screen="orbita">
      <OrbitBody />
    </ErrorBoundary>
  )
}

function OrbitBody() {
  useFocusEffect(
    useCallback(() => {
      track('tab_changed', { tab: 'orbita' })
    }, []),
  )
  const [segment, setSegment] = useState<OrbitSegment>('dia')

  useFocusEffect(
    useCallback(() => {
      const pending = consumeOrbitSegment()
      if (pending) setSegment(pending)
    }, []),
  )

  useEffect(() => {
    track('orbit_viewed', { segment })
  }, [segment])

  // Pause every screen-active-gated loop (OrbitalSystem, ScreenCosmos, …) while
  // the page is actively scrolling — the orbit diagram is the heaviest tab, so
  // splitting the UI thread between scroll frames and its SVG/Skia repaint is
  // the jank. Debounced idle flips it back ~140 ms after the last scroll event.
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollIdle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleScroll = useCallback(() => {
    setIsScrolling((s) => (s ? s : true))
    if (scrollIdle.current) clearTimeout(scrollIdle.current)
    scrollIdle.current = setTimeout(() => setIsScrolling(false), 140)
  }, [])

  // Deferred mount — Órbita is the heaviest tab (ScreenCosmos Skia nebula +
  // the orbital diagram's Skia canvases + big SVG). On the FIRST tap its slow
  // first paint left the screen black. Paint the LIGHT chrome first (dark sky +
  // the skeleton) so the tab shows something immediately, then mount the heavy
  // content one frame later (it fades in over the skeleton). freezeOnBlur is
  // off, so OrbitBody stays mounted after the first visit → no re-flash on
  // return; the skeleton only ever shows once.
  const [heavyMounted, setHeavyMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setHeavyMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (!heavyMounted) {
    return (
      <View style={styles.screen}>
        <SkyBackground />
        <SafeAreaView style={styles.flex} edges={['top']}>
          <LoadingView />
        </SafeAreaView>
      </View>
    )
  }

  return (
    <ScrollPauseContext.Provider value={isScrolling}>
      <View style={styles.screen}>
        <SkyBackground />
        <ScreenCosmos width={SCREEN_W} height={SCREEN_H} />

        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id="orbit-ambient" cx="50%" cy="48%" rx="75%" ry="70%">
              <Stop offset="0%" stopColor="#E91E63" stopOpacity={0.18} />
              <Stop offset="55%" stopColor="#E91E63" stopOpacity={0.06} />
              <Stop offset="100%" stopColor="#E91E63" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#orbit-ambient)" />
        </Svg>

        <SafeAreaView style={styles.flex} edges={['top']}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            <Animated.View entering={FadeIn.duration(280)}>
              <TabHeader title="Tu Órbita" titleEmphasis="Tu" />
            </Animated.View>

            <Animated.View entering={FadeIn.duration(320).delay(80)}>
              <OrbitSegments value={segment} onChange={setSegment} />
            </Animated.View>

            {/* Only the active segment is mounted — so only ONE constellation's
              Reanimated loops + Skia canvas exist at a time. (Keeping all three
              mounted + frozen does NOT pause Reanimated loops — react-freeze
              only suspends React renders, the withRepeat timers keep running on
              the UI thread — so it would TRIPLE the animation load. Conditional
              mount is the cheaper baseline.) The `key` replays the fade-in.
              Semana hands the segment switch back for its "Abrir Día" CTA. */}
            {segment === 'dia' ? (
              <DaySegment key="dia" />
            ) : segment === 'semana' ? (
              <WeekSegment key="semana" onOpenDia={() => setSegment('dia')} />
            ) : (
              <MonthSegment key="mes" />
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </ScrollPauseContext.Provider>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
})
