import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  DiaSegment,
  OrbitSegments,
  SegmentPlaceholder,
  type OrbitSegment,
} from '@/features/orbita/components'
import { SkyBackground, TabHeader } from '@/features/tabs/components'
import { colors } from '@/theme'

/*
 * Tu Órbita — STELAR's core tab, the meaning layer. Three time
 * altitudes of one sky: Día (El Sistema) · Semana (Las Órbitas) ·
 * Mes (El Cielo). See docs/tu-orbita-design.md.
 *
 * Día renders the live orbital diagram (DiaSegment). Semana and Mes
 * still show a "still forming" placeholder — their engine-fed pieces
 * (Voz de Stelar, Patrones) arrive once the Anthropic key is in.
 */
const PLACEHOLDERS: Record<
  Exclude<OrbitSegment, 'dia'>,
  { eyebrow: string; title: string; body: string }
> = {
  semana: {
    eyebrow: 'Las Órbitas',
    title: 'Aún no hay órbitas que leer',
    body: 'Tus patrones se revelan cuando el cielo acumula suficientes noches.',
  },
  mes: {
    eyebrow: 'El Cielo',
    title: 'Tu primer ciclo se dibuja',
    body: 'Aquí se sellará tu constelación cuando cierres el mes.',
  },
}

export default function OrbitaScreen() {
  const [segment, setSegment] = useState<OrbitSegment>('dia')

  return (
    <View style={styles.screen}>
      <SkyBackground />

      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.duration(280)}>
            <TabHeader title="Tu Órbita" titleEmphasis="Tu" />
          </Animated.View>

          <Animated.View entering={FadeIn.duration(320).delay(80)}>
            <OrbitSegments value={segment} onChange={setSegment} />
          </Animated.View>

          {/* key re-mounts on switch so the fade-in replays per segment. */}
          {segment === 'dia' ? (
            <DiaSegment key="dia" />
          ) : (
            <SegmentPlaceholder
              key={segment}
              eyebrow={PLACEHOLDERS[segment].eyebrow}
              title={PLACEHOLDERS[segment].title}
              body={PLACEHOLDERS[segment].body}
            />
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
