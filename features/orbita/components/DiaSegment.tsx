import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { useProfile } from '@/features/profile/hooks'
import { zodiacFromDate } from '@/features/tabs/zodiac'
import { colors, typography } from '@/theme'

import { useTodaySignals } from '../hooks'
import {
  countEnLuz,
  deriveDimensions,
  dimensionDetail,
  dimensionState,
  type DimensionKey,
} from '../logic'
import { OrbitalSystem } from './OrbitalSystem'

/*
 * The Día segment — "El Sistema". Reads today's signals, resolves the
 * six dimensions' brightness, and renders the orbital diagram. Tapping
 * a body selects it and surfaces a short readout below; tapping it
 * again clears the selection.
 *
 * While the query loads (or nothing is logged yet) every dimension
 * sits at the floor, so the diagram is always present — forming,
 * never empty.
 */
export function DiaSegment() {
  const { data } = useTodaySignals()
  const { data: profile } = useProfile()
  const signals = data ?? null
  const dimensions = deriveDimensions(signals)
  const sign = zodiacFromDate(profile?.date_of_birth)
  const name = (profile?.display_name ?? '').trim().split(' ')[0] || 'Tú'
  const [selectedKey, setSelectedKey] = useState<DimensionKey | null>(null)

  const enLuz = countEnLuz(dimensions)
  const lejos = dimensions.length - enLuz
  const selected = selectedKey ? (dimensions.find((d) => d.key === selectedKey) ?? null) : null

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      <View style={styles.header}>
        <EyebrowLabel tone="niebla" size={10}>
          Tu sistema
        </EyebrowLabel>
        <Text style={styles.count}>
          <Text style={styles.countLuz}>{enLuz} en luz</Text>
          <Text>{`  ·  ${lejos} lejos`}</Text>
        </Text>
      </View>

      {/* Full-bleed — the diagram is the hero, it breaks out of the
          screen's 20px gutter so the planets read large. */}
      <View style={styles.diagram}>
        <OrbitalSystem
          dimensions={dimensions}
          sign={sign}
          name={name}
          selectedKey={selectedKey}
          onSelect={(k) => setSelectedKey((cur) => (cur === k ? null : k))}
        />
      </View>

      {selected ? (
        <Animated.View key={selected.key} entering={FadeIn.duration(220)} style={styles.readout}>
          <View style={styles.readoutTop}>
            <Text style={styles.readoutLabel}>{selected.label}</Text>
            <Text
              style={[
                styles.readoutState,
                dimensionState(selected.brightness) === 'en luz'
                  ? styles.stateLuz
                  : styles.stateLejos,
              ]}
            >
              {dimensionState(selected.brightness)}
            </Text>
          </View>
          <Text style={styles.readoutDetail}>{dimensionDetail(selected.key, signals)}</Text>
        </Animated.View>
      ) : (
        <Text style={styles.hint}>Toca una dimensión para leerla.</Text>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
  },
  // Breaks out of the screen's horizontal gutter (orbita.tsx pads 20).
  diagram: {
    marginHorizontal: -20,
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
  hint: {
    marginTop: 4,
    textAlign: 'center',
    fontFamily: typography.uiMedium,
    fontSize: 12,
    color: colors.niebla,
  },
  // The tapped dimension's readout — a quiet card under the diagram.
  readout: {
    marginTop: 6,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bruma,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  readoutTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readoutLabel: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    color: colors.leche,
    letterSpacing: 1.6,
  },
  readoutState: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  stateLuz: {
    color: colors.magenta,
  },
  stateLejos: {
    color: colors.niebla,
  },
  readoutDetail: {
    marginTop: 7,
    fontFamily: typography.uiMedium,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.bone,
  },
})
