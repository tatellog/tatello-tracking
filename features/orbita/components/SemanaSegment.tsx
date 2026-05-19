import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { useProfile } from '@/features/profile/hooks'
import { zodiacFromDate } from '@/features/tabs/zodiac'
import { colors, typography } from '@/theme'

import { MOCK_PATRONES, MOCK_SEMANA, MOCK_VOZ } from '../mock'
import { PatternCard } from './PatternCard'
import { VozDeStelar } from './VozDeStelar'
import { WeekRing } from './WeekRing'

/*
 * The Semana segment — "Las Órbitas". Its hero is the week-ring: your
 * seven days orbiting you, each glowing with how it went. Below it,
 * the coach's weekly reading and the patterns the engine detected.
 * Content is MOCK (see ../mock.ts) until the engine lands.
 */
const EN_LUZ = 0.55

export function SemanaSegment() {
  const { data: profile } = useProfile()
  const sign = zodiacFromDate(profile?.date_of_birth)

  // Today starts selected — you open Semana already reading your day.
  const todayIdx = MOCK_SEMANA.findIndex((d) => d.today)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(todayIdx >= 0 ? todayIdx : null)

  // Counts run over the days lived so far — today and before.
  const livedCount = todayIdx < 0 ? MOCK_SEMANA.length : todayIdx + 1
  const enLuz = MOCK_SEMANA.slice(0, livedCount).filter((d) => d.brightness >= EN_LUZ).length
  const porVenir = MOCK_SEMANA.length - livedCount
  const selected = selectedIdx != null ? MOCK_SEMANA[selectedIdx] : null

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      <View style={styles.header}>
        <EyebrowLabel tone="niebla" size={10}>
          Tu semana
        </EyebrowLabel>
        <Text style={styles.count}>
          <Text style={styles.countLuz}>{enLuz} en luz</Text>
          <Text>{`  ·  ${porVenir} por venir`}</Text>
        </Text>
      </View>

      {/* Hero — the week-ring, full-bleed like the Día diagram. */}
      <View style={styles.diagram}>
        <WeekRing
          days={MOCK_SEMANA}
          sign={sign}
          selectedIdx={selectedIdx}
          onSelect={(i) => setSelectedIdx((cur) => (cur === i ? null : i))}
        />
      </View>

      {selected ? (
        <Animated.View key={selectedIdx} entering={FadeIn.duration(220)} style={styles.readout}>
          <Text style={styles.readoutText}>{selected.note}</Text>
        </Animated.View>
      ) : (
        <Text style={styles.hint}>Toca un día para leerlo.</Text>
      )}

      <VozDeStelar scope="esta semana" text={MOCK_VOZ.semana} />

      <View style={styles.patHeader}>
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
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  count: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    color: colors.niebla,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  countLuz: {
    color: colors.magenta,
  },
  // Full-bleed — the hero breaks out of the screen's 20px gutter.
  diagram: {
    marginHorizontal: -20,
  },
  hint: {
    marginTop: 4,
    textAlign: 'center',
    fontFamily: typography.uiMedium,
    fontSize: 12,
    color: colors.niebla,
  },
  // The tapped day's readout.
  readout: {
    marginTop: 6,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bruma,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  readoutText: {
    fontFamily: typography.uiMedium,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.bone,
  },
  patHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 2,
  },
})
