import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EmText } from '@/components/EmText'
import { markSeenStelarReveal, readSeenStelarReveal } from '@/lib/onboardingFlags'
import { colors, typography } from '@/theme'

import { useTodaySignals } from '../hooks'
import {
  countTones,
  deriveDimensions,
  dimensionDetail,
  dimensionEvidence,
  dimensionTone,
  type DimensionKey,
} from '../logic'
import { MOCK_ACCION_DEL_DIA, MOCK_ARQUETIPO, MOCK_HEADLINE, MOCK_VOZ_DIA } from '../mock'
import { AccionDelDia } from './AccionDelDia'
import { LiveDot } from './LiveDot'
import { OrbitalSystem } from './OrbitalSystem'
import { StelarHeadline } from './StelarHeadline'
import { VozDeStelar } from './VozDeStelar'

/*
 * The Día segment — "El Sistema". Reads today's signals, resolves the
 * six dimensions' brightness, and renders the orbital diagram. The
 * surrounding flow is structured so the AI never feels hidden:
 *
 *   header (compressed: archetype + one meta line)
 *   StelarHeadline   ← lifted lede of the reading, above the orbital
 *   orbital diagram  ← the visual system
 *   readout          ← tap a dimension; shows verdict + evidence
 *   AccionDelDia     ← the one move the IA recommends today
 *   Voz de Stelar    ← the full prose reading
 *
 * Archetype + Voz de Stelar + headline + action are MOCK
 * (../mock.ts); the engine will write them from daily_signals.
 */
export function DiaSegment() {
  const { data } = useTodaySignals()
  const signals = data ?? null
  const dimensions = deriveDimensions(signals)
  const [selectedKey, setSelectedKey] = useState<DimensionKey | null>(null)

  const tones = countTones(dimensions)
  const selected = selectedKey ? (dimensions.find((d) => d.key === selectedKey) ?? null) : null
  const selectedTone = selected ? dimensionTone(selected.brightness) : null
  const evidence = selected ? dimensionEvidence(selected.key, signals) : []
  const reveal = useFirstReadReveal()

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      {/* Compressed header — archetype as the only hero, with a single
          dense meta line that names tones, the read window, and how
          deep STELAR has read so far. */}
      <View style={styles.header}>
        <EmText
          text={MOCK_ARQUETIPO.name}
          emphasis={MOCK_ARQUETIPO.emphasis}
          style={styles.archetype}
          emStyle={styles.archetypeEm}
        />
        <View style={styles.metaRow}>
          <LiveDot />
          <View style={styles.metaStack}>
            {/* Each tone is its own coloured run — the meta row reads
                as a tiny visual map of the system, not a numeric list.
                Magenta is reserved for what truly shines. */}
            <Text
              style={styles.meta}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              <Text style={styles.toneBrillante}>{tones.brillantes} brillantes</Text>
              <Text style={styles.metaSep}> · </Text>
              <Text style={styles.toneFormacion}>{tones.formacion} en formación</Text>
              <Text style={styles.metaSep}> · </Text>
              <Text style={styles.toneSilencio}>{tones.silencio} en silencio</Text>
            </Text>
            <Text style={styles.metaB} numberOfLines={1}>
              <Text>leído por </Text>
              <Text style={styles.metaStelar}>Stelar</Text>
              <Text>{` · ${MOCK_ARQUETIPO.daysRead} días`}</Text>
            </Text>
          </View>
        </View>
      </View>

      {/* Lifted lede — STELAR's read in two lines, before the visual. */}
      <StelarHeadline parts={MOCK_HEADLINE.parts} />

      {/* Full-bleed — the diagram is the hero, it breaks out of the
          screen's 20px gutter so the bodies read large. */}
      <View style={styles.diagram}>
        <OrbitalSystem
          dimensions={dimensions}
          selectedKey={selectedKey}
          onSelect={(k) => setSelectedKey((cur) => (cur === k ? null : k))}
        />
      </View>

      {selected && selectedTone ? (
        <Animated.View key={selected.key} entering={FadeIn.duration(220)} style={styles.readout}>
          <View style={styles.readoutTop}>
            <View style={styles.readoutLabelRow}>
              <Text style={styles.readoutLabel}>{selected.label}</Text>
              {/* The one-word poetic state — lifted from the orbital
                  so it lands here when the user is reading, not as
                  ambient noise on the diagram. */}
              {selected.word ? <Text style={styles.readoutWord}>{selected.word}</Text> : null}
            </View>
            <Text
              style={[
                styles.readoutState,
                selectedTone === 'brillante'
                  ? styles.toneBrillante
                  : selectedTone === 'en formación'
                    ? styles.toneFormacion
                    : styles.toneSilencio,
              ]}
            >
              {selectedTone}
            </Text>
          </View>
          <Text style={styles.readoutDetail}>{dimensionDetail(selected.key, signals)}</Text>
          {evidence.length > 0 ? (
            <View style={styles.evidenceBlock}>
              <Text style={styles.evidenceEyebrow}>Señales leídas</Text>
              <View style={styles.evidenceList}>
                {evidence.map((e, i) => (
                  <View key={e.label} style={styles.evidenceRow}>
                    <Text style={styles.evidenceLabel}>{e.label}</Text>
                    <Text style={styles.evidenceDot}>·</Text>
                    <Text style={styles.evidenceValue}>{e.value}</Text>
                    {i < evidence.length - 1 ? <View style={styles.evidenceGap} /> : null}
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.evidenceQuiet}>
              Cuando hay silencio, Stelar no inventa. Espera a que registres.
            </Text>
          )}
        </Animated.View>
      ) : (
        <Text style={styles.hint}>Toca una dimensión para leerla.</Text>
      )}

      {/* The one move STELAR weights highest today. Heavier card than
          Voz so it reads as call-to-action, not narration. */}
      <AccionDelDia title={MOCK_ACCION_DEL_DIA.title} reason={MOCK_ACCION_DEL_DIA.reason} />

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
  // The archetype name — the app's poetic register.
  archetype: {
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
  // Single dense meta row — tones + read window + depth %. The live
  // dot keeps the "Stelar is reading you" presence; the wrap is two
  // lines on narrow screens so depth never gets clipped.
  metaRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  metaStack: {
    flex: 1,
  },
  meta: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  // Second meta line — same chrome as the first, slight breathing room.
  metaB: {
    marginTop: 4,
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  // The middle dot between the three tones — barely there, just
  // enough to space them.
  metaSep: {
    color: colors.bruma,
  },
  metaStelar: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 12,
    color: colors.magenta,
    textTransform: 'none',
    letterSpacing: 0,
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
  readoutLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  readoutLabel: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    color: colors.leche,
    letterSpacing: 1.6,
  },
  // The poetic word — serif italic magenta, like the archetype.
  readoutWord: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14,
    color: colors.magenta,
  },
  readoutState: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  toneBrillante: {
    color: colors.magenta,
  },
  toneFormacion: {
    color: colors.bone,
  },
  toneSilencio: {
    color: colors.niebla,
  },
  readoutDetail: {
    marginTop: 7,
    fontFamily: typography.uiMedium,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.bone,
  },
  // Evidence — the chain of signals STELAR read to land on the
  // verdict. A hairline rule separates it from the verdict prose so
  // the reasoning reads as its own beat.
  evidenceBlock: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  evidenceEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 6,
  },
  evidenceList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  evidenceLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 12,
    color: colors.niebla,
  },
  evidenceDot: {
    marginHorizontal: 6,
    fontFamily: typography.ui,
    fontSize: 12,
    color: colors.bruma,
  },
  evidenceValue: {
    fontFamily: typography.uiBold,
    fontSize: 12,
    color: colors.leche,
  },
  evidenceGap: {
    width: 14,
  },
  // Honest line when there is nothing to cite — STELAR records,
  // doesn't invent.
  evidenceQuiet: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 19,
    color: colors.niebla,
  },
})
