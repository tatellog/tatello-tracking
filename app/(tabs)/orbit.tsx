import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
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
import { ErrorBoundary } from '@/components/ErrorBoundary'
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

  return (
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
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.duration(280)}>
            <TabHeader title="Tu Órbita" titleEmphasis="Tu" />
          </Animated.View>

          <Animated.View entering={FadeIn.duration(320).delay(80)}>
            <OrbitSegments value={segment} onChange={setSegment} />
          </Animated.View>

          {/* key re-mounts on switch so the fade-in replays per segment.
              Semana hands the segment switch back so its "Abrir Día"
              CTA can swap us into Día. */}
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
