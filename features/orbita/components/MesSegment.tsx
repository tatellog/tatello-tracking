import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

import { MOCK_CICLO, MOCK_PATRONES, MOCK_VOZ } from '../mock'
import { PatternCard } from './PatternCard'
import { VozDeStelar } from './VozDeStelar'

/*
 * The Mes segment — "El Cielo": the coach's reading of the cycle, the
 * current cycle phase, and the cycle-bound patterns. The constellation
 * sealing + "Tu Cielo" multi-cycle view belong here too — that's the
 * deferred cycle-lifecycle sprint. Content is MOCK (see ../mock.ts).
 */
export function MesSegment() {
  const ciclo = MOCK_CICLO
  const cyclePatterns = MOCK_PATRONES.filter((p) => p.id === 'lutea')

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      <VozDeStelar scope="este ciclo" text={MOCK_VOZ.mes} />

      <View style={styles.cycleCard}>
        <EyebrowLabel tone="magenta" size={10}>
          {ciclo.phase}
        </EyebrowLabel>
        <View style={styles.dayRow}>
          <Text style={styles.dayNum}>{ciclo.day}</Text>
          <Text style={styles.dayOf}>de {ciclo.length} días</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(ciclo.day / ciclo.length) * 100}%` }]} />
        </View>
        <Text style={styles.note}>{ciclo.note}</Text>
      </View>

      <View style={styles.header}>
        <EyebrowLabel tone="niebla" size={10}>
          Ligado a tu ciclo
        </EyebrowLabel>
      </View>
      {cyclePatterns.map((p) => (
        <PatternCard key={p.id} patron={p} />
      ))}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 6,
  },
  cycleCard: {
    marginTop: 14,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.bruma,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },
  dayNum: {
    fontFamily: typography.displayHeavy,
    fontSize: 44,
    color: colors.leche,
    letterSpacing: -2,
  },
  dayOf: {
    marginLeft: 8,
    fontFamily: typography.uiMedium,
    fontSize: 13,
    color: colors.niebla,
  },
  track: {
    marginTop: 12,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.bgCard2,
    overflow: 'hidden',
  },
  fill: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.magenta,
  },
  note: {
    marginTop: 12,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.bone,
  },
  header: {
    marginTop: 24,
    marginBottom: 2,
  },
})
