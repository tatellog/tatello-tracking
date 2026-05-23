import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

import {
  DiaSegment,
  MesSegment,
  OrbitSegments,
  SemanaSegment,
  type OrbitSegment,
} from '@/features/orbita/components'
import { SkyBackground, TabHeader } from '@/features/tabs/components'
import { colors } from '@/theme'

/*
 * Tu Órbita — STELAR's core tab, the meaning layer. Three time
 * altitudes of one sky: Día (El Sistema) · Semana (Las Órbitas) ·
 * Mes (El Cielo). See docs/tu-orbita-design.md.
 *
 * Día renders the live orbital diagram. The engine-fed pieces (Voz de
 * Stelar, patrones) currently run on MOCK data — see features/orbita/
 * mock.ts — until the Anthropic key is in.
 */
export default function OrbitaScreen() {
  const [segment, setSegment] = useState<OrbitSegment>('dia')

  return (
    <View style={styles.screen}>
      <SkyBackground />

      {/* Ambient warm glow — a soft radial wash centred behind the
          Día hero so the page doesn't read as a black-and-magenta
          rectangle. The gradient peaks at ~22 % opacity magenta in
          the centre and fades fully transparent at the edges, so
          it lifts the dark areas around the diagram (the bottom
          half + the right strip near the dimension list) without
          flattening the diagram's own contrast. */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="orbita-ambient" cx="50%" cy="45%" rx="65%" ry="55%">
            <Stop offset="0%" stopColor="#E91E63" stopOpacity={0.22} />
            <Stop offset="55%" stopColor="#E91E63" stopOpacity={0.08} />
            <Stop offset="100%" stopColor="#E91E63" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#orbita-ambient)" />
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
            <DiaSegment key="dia" />
          ) : segment === 'semana' ? (
            <SemanaSegment key="semana" onOpenDia={() => setSegment('dia')} />
          ) : (
            <MesSegment key="mes" />
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
