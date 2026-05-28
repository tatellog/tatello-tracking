import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'

import { EmText } from '@/components/EmText'
import { markSeenStelarReveal, readSeenStelarReveal } from '@/lib/onboardingFlags'
import { colors, typography } from '@/theme'

import { ENGINE_ACTIVE } from '../engine'
import { useHasAnySignals, useTodaySignals } from '../hooks'
import {
  deriveDimensions,
  dimensionDetail,
  dimensionEvidence,
  dimensionTone,
  type DimensionKey,
} from '../logic'
import { MOCK_ACCION_DEL_DIA, MOCK_ARQUETIPO, MOCK_HEADLINE, MOCK_VOZ_DIA } from '../mock'
import { DayAction } from './DayAction'
import { CosmicParticles } from './CosmicParticles'
import { EmptySegmentCard } from './EmptySegmentCard'
import { LiveDot } from './LiveDot'
import { OrbitalSystem } from './OrbitalSystem'
import { PreviewBanner } from './PreviewBanner'
import { StelarHeadline } from './StelarHeadline'
import { StelarVoice } from './StelarVoice'

/*
 * The Día segment — "El Sistema". Reads today's signals, resolves the
 * six dimensions' brightness, and renders the orbital diagram. The
 * surrounding flow is structured so the AI never feels hidden:
 *
 *   header (compressed: archetype + one meta line)
 *   StelarHeadline   ← lifted lede of the reading, above the orbital
 *   orbital diagram  ← the visual system
 *   readout          ← tap a dimension; shows verdict + evidence
 *   DayAction     ← the one move the IA recommends today
 *   Voz de Stelar    ← the full prose reading
 *
 * Archetype + Voz de Stelar + headline + action are MOCK
 * (../mock.ts); the engine will write them from daily_signals.
 */
export function DaySegment() {
  const { data } = useTodaySignals()
  const { data: hasAny } = useHasAnySignals()
  const signals = data ?? null
  const dimensions = deriveDimensions(signals)
  const [selectedKey, setSelectedKey] = useState<DimensionKey | null>(null)

  const selected = selectedKey ? (dimensions.find((d) => d.key === selectedKey) ?? null) : null
  const selectedTone = selected ? dimensionTone(selected.brightness) : null
  const evidence = selected ? dimensionEvidence(selected.key, signals) : []
  // The first-reading reveal frames the prose as "Stelar read your
  // last N days" — only honest once the engine actually has.
  const reveal = useFirstReadReveal() && ENGINE_ACTIVE

  // Empty-state branch: hide every MOCK-driven prose (archetype,
  // headline, voz, acción) and show a single coach-voice card that
  // tells the user what to register. The orbital still renders so
  // the visual identity of Día stays consistent.
  if (hasAny === false) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        <View style={styles.header}>
          <EmText
            text="tu primer día"
            emphasis="primer día"
            style={styles.archetype}
            emStyle={styles.archetypeEm}
          />
        </View>
        <View style={styles.diagram}>
          <OrbitalSystem
            dimensions={dimensions}
            selectedKey={selectedKey}
            onSelect={(k) => setSelectedKey((cur) => (cur === k ? null : k))}
          />
        </View>
        <EmptySegmentCard
          eyebrow="Stelar te empieza a leer"
          body="Registra algo — una comida, tu sueño de anoche, un entreno, un vaso de agua. Cualquier señal vale."
          hint="Cuando haya algo registrado, esta pantalla se transforma en tu lectura."
        />
      </Animated.View>
    )
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      {/* Honest framing while the engine is mock — the prose below is
          an example, not a real reading. */}
      {ENGINE_ACTIVE ? null : <PreviewBanner />}

      {/* Compact header — archetype as the only hero. The "Tu
          lente de hoy" eyebrow + per-tone counts were removed:
          the orbital diagram itself shows how many dimensions are
          brillantes (bright halos) and en formación (dim), so the
          textual meta was duplicating visual info. LiveDot stays
          when the engine is active to signal a live read. */}
      <View style={styles.header}>
        <EmText
          text={MOCK_ARQUETIPO.name}
          emphasis={MOCK_ARQUETIPO.emphasis}
          style={styles.archetype}
          emStyle={styles.archetypeEm}
        />
        {ENGINE_ACTIVE ? (
          <View style={styles.metaRow}>
            <LiveDot />
            <Text style={styles.metaB} numberOfLines={1}>
              <Text>leído por </Text>
              <Text style={styles.metaStelar}>Stelar</Text>
              <Text>{` · ${MOCK_ARQUETIPO.daysRead} días`}</Text>
            </Text>
          </View>
        ) : null}
      </View>

      {/* Lifted lede — STELAR's read in two lines, before the visual. */}
      <StelarHeadline parts={MOCK_HEADLINE.parts} />

      {/* Hero — the orbital diagram takes the full bleed. The
          right-side six-dimension node list was retired: with each
          star now carrying its own colors.dimension halo + an on-orbital
          serif mini-label, the column was duplicating info, eating
          ~35 % horizontal real estate and clipping the focus label
          behind the panel. Discovery now lives inside the orbital
          (mini-labels at rest, glyph + "tu cuerpo / tu sueño /..."
          when zoomed in). */}
      <View style={styles.heroRow}>
        <CosmicParticles />
        <OrbitalSystem
          dimensions={dimensions}
          selectedKey={selectedKey}
          onSelect={(k) => setSelectedKey((cur) => (cur === k ? null : k))}
        />
        {/* Bottom fade — the previous gradient faded to
            `colors.bg` (#0A0608), but below heroRow the
            SkyBackground composites magentaTint2 over the page bg
            → about #1A0810. The mismatch produced a visible band.
            Now the gradient fades to that composited wine tone
            (matched to the pill bg) so the transition reads as a
            continuous sky, not a step. */}
        <LinearGradient
          colors={['transparent', '#1A0810']}
          locations={[0, 1]}
          pointerEvents="none"
          style={styles.heroFade}
        />

        {/* Readout overlay — when a dimension is selected, the
            informational layer rises INSIDE the orbital container
            (bottom band) instead of sitting in a separate card the
            user had to scroll to find. Same FadeInDown timing as
            before (180 ms delay so it lands after the camera flies
            in). The orbital fades behind the overlay so the focus
            cinematic + the data land in the same eyeline. */}
        {selected && selectedTone ? (
          <Animated.View
            key={selected.key}
            entering={FadeInDown.duration(360).delay(180)}
            style={styles.readoutOverlay}
          >
            <View style={styles.readoutTop}>
              <View style={styles.readoutLabelRow}>
                <Text style={styles.readoutLabel}>{selected.label}</Text>
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
        ) : null}
      </View>

      {!selected ? <Text style={styles.hint}>Toca una dimensión para leerla.</Text> : null}

      {/* The one move STELAR weights highest today. Heavier card than
          Voz so it reads as call-to-action, not narration. */}
      <DayAction title={MOCK_ACCION_DEL_DIA.title} reason={MOCK_ACCION_DEL_DIA.reason} />

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
            <StelarVoice parts={MOCK_VOZ_DIA.parts} />
          </Animated.View>
        </Animated.View>
      ) : (
        <StelarVoice parts={MOCK_VOZ_DIA.parts} />
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
  // Full-bleed hero — the orbital fills the screen width (escaping
  // the 20 px gutter from orbita.tsx). `position: relative` anchors
  // the absolute-positioned CosmicParticles + heroFade overlays.
  heroRow: {
    marginHorizontal: -20,
    marginTop: 4,
    position: 'relative',
  },
  heroFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 140,
  },
  // Readout overlay — translucent panel anchored to the bottom of
  // the orbital container. Replaces the old below-the-hero card so
  // the info lands within the same eyeline as the focus cinematic.
  // Bg is dark + slightly translucent so the orbital reads as a
  // soft texture underneath. Bronze hairline top edge to feel like
  // a stelar artifact emerging from the system.
  readoutOverlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 18,
    backgroundColor: 'rgba(20, 8, 18, 0.82)',
    borderRadius: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(217, 174, 111, 0.22)',
    padding: 16,
    gap: 10,
  },
  header: {
    alignItems: 'center',
  },
  // Frames the archetype as a passing lens, not an identity.
  lensEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 8,
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
