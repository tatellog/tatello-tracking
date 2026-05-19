import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { EmText } from '@/components/EmText'
import { useProfile } from '@/features/profile/hooks'
import { zodiacFromDate } from '@/features/tabs/zodiac'
import { markSeenStelarReveal, readSeenStelarReveal } from '@/lib/onboardingFlags'
import { colors, typography } from '@/theme'

import { useTodaySignals } from '../hooks'
import {
  countEnLuz,
  deriveDimensions,
  dimensionDetail,
  dimensionState,
  type DimensionKey,
} from '../logic'
import { MOCK_ARQUETIPO, MOCK_VOZ_DIA } from '../mock'
import { OrbitalSystem } from './OrbitalSystem'
import { VozDeStelar } from './VozDeStelar'

/*
 * The Día segment — "El Sistema". Reads today's signals, resolves the
 * six dimensions' brightness, and renders the orbital diagram under
 * the archetype the engine names you with. The header credits the
 * read to Stelar and shows its scope — days and dimensions read — so
 * the intelligence behind the archetype is named, not hidden. Tapping
 * a body selects it and surfaces a short readout below.
 *
 * While the query loads (or nothing is logged yet) every dimension
 * sits at the floor, so the diagram is always present — forming,
 * never empty. The archetype + Voz de Stelar are MOCK (../mock.ts).
 */
export function DiaSegment() {
  const { data } = useTodaySignals()
  const { data: profile } = useProfile()
  const signals = data ?? null
  const dimensions = deriveDimensions(signals)
  const sign = zodiacFromDate(profile?.date_of_birth)
  const [selectedKey, setSelectedKey] = useState<DimensionKey | null>(null)

  const enLuz = countEnLuz(dimensions)
  const lejos = dimensions.length - enLuz
  const selected = selectedKey ? (dimensions.find((d) => d.key === selectedKey) ?? null) : null
  const reveal = useFirstReadReveal()

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      {/* The archetype — the identity pattern Stelar reads in you. */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Tu sistema · Hoy</Text>
        <EmText
          text={MOCK_ARQUETIPO.name}
          emphasis={MOCK_ARQUETIPO.emphasis}
          style={styles.archetype}
          emStyle={styles.archetypeEm}
        />
        <Text style={styles.stats}>
          <Text style={styles.statNum}>{enLuz}</Text>
          <Text> en luz </Text>
          <Text style={styles.statDot}>·</Text>
          <Text style={styles.statNum}> {lejos}</Text>
          <Text> lejos</Text>
        </Text>

        {/* Credit + scope — the read is Stelar's, and it shows what
            it read, so the intelligence is named, not hidden. The
            block sits in its own breathing space below the stats —
            no rule line, the live dot is the only visual change. */}
        <View style={styles.metaRow}>
          <LiveDot />
          <Text style={styles.meta}>
            <Text>Leído por </Text>
            <Text style={styles.metaStelar}>Stelar</Text>
            <Text>{`   ·   ${MOCK_ARQUETIPO.daysRead} días   ·   ${dimensions.length} dimensiones`}</Text>
          </Text>
        </View>
      </View>

      {/* Full-bleed — the diagram is the hero, it breaks out of the
          screen's 20px gutter so the bodies read large. */}
      <View style={styles.diagram}>
        <OrbitalSystem
          dimensions={dimensions}
          sign={sign}
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

      {reveal ? (
        <Animated.View entering={FadeIn.duration(700)}>
          {/* One-time framing — names the first reading as Stelar's. */}
          <View style={styles.revealIntro}>
            <Text style={styles.revealEyebrow}>Tu primera lectura</Text>
            <Text style={styles.revealLine}>
              Stelar leyó tus últimos {MOCK_ARQUETIPO.daysRead} días para escribir lo que sigue.
              Cuanto más registres, más te conoce.
            </Text>
          </View>
          <Animated.View entering={FadeIn.duration(1100).delay(420)}>
            <VozDeStelar parts={MOCK_VOZ_DIA.parts} />
          </Animated.View>
        </Animated.View>
      ) : (
        <VozDeStelar parts={MOCK_VOZ_DIA.parts} />
      )}
    </Animated.View>
  )
}

/* The first time the user reaches a Stelar reading, surface a one-time
 * reveal that frames it as Stelar's work — then mark it seen so it
 * never shows again. */
function useFirstReadReveal(): boolean {
  const [reveal, setReveal] = useState(false)
  useEffect(() => {
    let alive = true
    readSeenStelarReveal()
      .then((seen) => {
        if (!alive || seen) return
        setReveal(true)
        void markSeenStelarReveal()
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return reveal
}

/* A softly breathing dot — Stelar's presence: it is reading you now,
 * not showing a frozen stat. */
function LiveDot() {
  const p = useSharedValue(0)
  useEffect(() => {
    p.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    )
    return () => cancelAnimation(p)
  }, [p])

  const halo = useAnimatedStyle(() => ({
    opacity: 0.16 + p.value * 0.4,
    transform: [{ scale: 0.7 + p.value * 0.7 }],
  }))

  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.dotHalo, halo]} />
      <View style={styles.dotCore} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
  },
  // Breaks out of the screen's horizontal gutter (orbita.tsx pads 20).
  diagram: {
    marginHorizontal: -20,
    marginTop: 4,
  },
  header: {
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  // The archetype name — the app's poetic register.
  archetype: {
    marginTop: 8,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 27,
    lineHeight: 32,
    color: colors.leche,
    textAlign: 'center',
  },
  archetypeEm: {
    color: colors.magenta,
  },
  stats: {
    marginTop: 9,
    fontFamily: typography.uiBold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
    textAlign: 'center',
  },
  statNum: {
    color: colors.magenta,
  },
  statDot: {
    color: colors.bruma,
  },
  metaRow: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // The Stelar credit + read scope.
  meta: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  // The intelligence, named — serif italic, the coach register.
  metaStelar: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 12.5,
    color: colors.magenta,
  },
  // The live-presence dot.
  dotWrap: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  dotHalo: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.magenta,
  },
  dotCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.magentaHot,
  },
  hint: {
    marginTop: 4,
    textAlign: 'center',
    fontFamily: typography.uiMedium,
    fontSize: 12,
    color: colors.niebla,
  },
  // The one-time first-reading reveal, above the Voz de Stelar card.
  revealIntro: {
    marginTop: 22,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  revealEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: colors.magenta,
  },
  revealLine: {
    marginTop: 8,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.bone,
    textAlign: 'center',
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
