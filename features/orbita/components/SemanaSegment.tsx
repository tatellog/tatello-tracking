import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

import { MOCK_PATRONES, MOCK_VOZ } from '../mock'
import { PatternCard } from './PatternCard'
import { VozDeStelar } from './VozDeStelar'

/*
 * The Semana segment — "Las Órbitas": the coach's weekly reading plus
 * the patterns the engine found across the week's daily_signals.
 * Content is MOCK (see ../mock.ts) until the engine lands.
 */
export function SemanaSegment() {
  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      <VozDeStelar scope="esta semana" text={MOCK_VOZ.semana} />

      <View style={styles.header}>
        <EyebrowLabel tone="niebla" size={10}>
          Patrones detectados
        </EyebrowLabel>
        <Text style={styles.count}>{MOCK_PATRONES.length} lecturas</Text>
      </View>

      {MOCK_PATRONES.map((p) => (
        <PatternCard key={p.id} patron={p} />
      ))}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 2,
  },
  count: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
})
