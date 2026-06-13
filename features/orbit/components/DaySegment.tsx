import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'

import { useCycleEnabled } from '@/features/cycle/useCycleEnabled'
import { useMacroTargets } from '@/features/macros/hooks'
import { EmText } from '@/components/EmText'
import { markSeenStelarReveal, readSeenStelarReveal } from '@/lib/onboardingFlags'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

import { ENGINE_ACTIVE } from '../engine'
import { useHasAnySignals, useTodaySignals } from '../hooks'
import { useDailyIntelligence } from '../useDailyIntelligence'
import {
  buildDayIdentity,
  buildDayVoice,
  deriveDimensions,
  dimensionDetail,
  dimensionEvidence,
  dimensionTone,
  type DimensionKey,
} from '../logic'
import { MOCK_ACCION_DEL_DIA, MOCK_ARQUETIPO, MOCK_VOZ_DIA } from '../mock'
import { DayAction } from './DayAction'
import { DayLiveReadings } from './DayLiveReadings'
import { EmptySegmentCard } from './EmptySegmentCard'
import { LiveDot } from './LiveDot'
import { OrbitalSystem } from './OrbitalSystem'
import { StelarVoice } from './StelarVoice'

/*
 * The Día segment — "El Sistema". Reads today's signals, resolves the
 * six dimensions' brightness, and renders the orbital diagram. The
 * surrounding flow is structured so the AI never feels hidden:
 *
 *   header           ← REAL day identity (one-word state + en-luz count)
 *   orbital diagram  ← the visual system (6 stars brighten with signal)
 *   readout          ← tap a dimension; shows verdict + evidence
 *   Voz de Stelar    ← REAL factual reading of TODAY (qué registré / qué
 *                      falta) — deterministic, always on (PRD V1)
 *   DayLiveReadings  ← "Cómo va tu día" — real, goal-aware readings
 *   DayAction        ← the one move the IA recommends today (gated, MOCK)
 *
 * Header + Voz de Stelar + live readings are REAL (shared intelligence
 * lib). Only DayAction (+ the richer engine prose) stays behind
 * ENGINE_ACTIVE — the AI will enrich the same Voz from daily_signals.
 */
// When a dimension is in silence, invite the user to register the signal
// that lights it — instead of a dead-end. Oro afford, tappable. Ciclo has
// no afford (it's anchored when the period actually starts, not "today").
const AFFORD_TEXT: Partial<Record<DimensionKey, string>> = {
  sueno: 'Registra tu sueño para encender esta estrella',
  mente: 'Cuéntale a Stelar cómo te sentiste',
  cuerpo: 'Anota tu movimiento de hoy',
  energia: 'Marca tu energía de hoy',
  alimento: 'Registra una comida',
}

/* Maps the focused dimension to the StatSlider slide id that owns
 * registering that signal — so tapping the CTA lands the user on
 * the right card, not at the top of Hoy where they'd have to swipe
 * looking for it. `cuerpo` has no slide (its check-in is the
 * DayCheckIn at the top of Hoy), so the absence sends the user
 * straight to the Hoy root. */
const SLIDE_FOR_DIM: Partial<Record<DimensionKey, string>> = {
  sueno: 'sleep',
  mente: 'wellbeing',
  energia: 'wellbeing',
  alimento: 'macros',
  ciclo: 'cycle',
}

/* Per-dimension QUIET line shown when no signal is registered yet
 * — replaces the previous single "Aún no hay señal aquí. Stelar
 * espera, no inventa." that repeated across all 5 silent states
 * (UX audit: "a la 4ª visita pasa de íntimo a script"). Each
 * dimension now has its own coach-voice line tied to its own
 * metaphor; the Stelar manifest contract ("no inventa") stays
 * implicit in the absence of evidence rather than as a recurring
 * footer slogan. */
const QUIET_LINE_FOR: Partial<Record<DimensionKey, string>> = {
  cuerpo: 'Tu cuerpo aún no ha hecho su trazo hoy.',
  mente: 'Tu mente todavía no se ha pronunciado.',
  energia: 'Tu energía aún no ha hablado hoy.',
  sueno: 'La noche aún no te ha contado.',
  alimento: 'Tu plato aún no ha aparecido.',
}

// Arrival payoff (P2A, contained): which dimensions crossed into "brillante"
// since the last visit. We snapshot the lit set in AsyncStorage and, on the
// next open, celebrate what newly lit — the visible reward for registering.
// Ciclo is excluded (it's anchored by its own chip, not "lit" daily).
const LIT_SNAPSHOT_KEY = '@app:orbit_lit'
const LIT_PHRASE: Partial<Record<DimensionKey, string>> = {
  cuerpo: 'tu cuerpo',
  energia: 'tu energía',
  mente: 'tu mente',
  alimento: 'tu comida',
  sueno: 'tu sueño',
}

export function DaySegment() {
  const router = useRouter()
  const { data } = useTodaySignals()
  const { data: hasAny } = useHasAnySignals()
  const signals = data ?? null
  // Macro targets make the `alimento` dimension deficit-aware (protein +
  // calories vs target) instead of a meal count — see deriveDimensions.
  const targets = useMacroTargets()
  const calorieTarget = targets.data?.calories ?? null
  const proteinTarget = targets.data?.protein_g ?? null
  // Gate de ciclo (cycle-gate.ts): sin ciclo activo, la dimensión `ciclo`
  // no existe en el orbital ni en ninguna lectura.
  const cycleEnabled = useCycleEnabled()
  const dimensions = deriveDimensions(signals, { calorieTarget, proteinTarget, cycleEnabled })
  // The Día header identity — a real, one-word state for TODAY from the same
  // live dimensions the orbital draws (shared lib; the BE returns the same
  // value in intel.day.header). Replaces the old mock archetype + headline.
  const dayHeader = buildDayIdentity(dimensions)

  // "Cómo va tu día" — today's goal-aware readings now come from the
  // BACKEND engine (daily-intelligence Edge Function); the hook falls back
  // to the same local rules if it's unreachable.
  const intel = useDailyIntelligence()
  // Defensa extra sobre el payload (puede venir cacheado del BE de antes
  // del gate, o con cycle_events viejos): sin ciclo, fuera el chip de
  // periodo — y si la tarjeta queda vacía, fuera la tarjeta.
  const rawReadings = intel.data?.day.readings ?? []
  const dayReadings = cycleEnabled
    ? rawReadings
    : rawReadings
        .map((c) => ({ ...c, metrics: c.metrics.filter((m) => m.key !== 'cycle') }))
        .filter((c) => c.metrics.length > 0 || c.coach != null)
  const [selectedKey, setSelectedKey] = useState<DimensionKey | null>(null)
  const [ignited, setIgnited] = useState<DimensionKey[]>([])

  // Voz de Stelar (PRD V1) — la traducción humana y FACTUAL de hoy: qué
  // registraste + qué sigue en calma. Determinista (sin IA, sin gate);
  // lee las mismas dimensiones que el hero. Reemplaza el viejo lede
  // poético rotado: el PRD pide observación de los datos, no estado de
  // ánimo. NUNCA se silencia (siempre hay un "qué registré" que decir).
  const voz = buildDayVoice(signals, { cycleEnabled })

  // On arrival, celebrate the dimensions that newly crossed into
  // "brillante" TODAY. Snapshot is date-stamped: a snapshot from another
  // day doesn't count (el Día nunca compara jornadas — PRD). So we only
  // ever celebrate lighting that happened HOY — from an empty sky on the
  // day's first visit, or from earlier-today on a re-visit (intra-día, ok).
  useEffect(() => {
    if (!signals) return
    const today = todayInTimezone()
    const dims = deriveDimensions(signals, { calorieTarget, proteinTarget, cycleEnabled })
    const current: Record<string, boolean> = {}
    dims.forEach((d) => {
      current[d.key] = dimensionTone(d.brightness) === 'brillante'
    })
    let alive = true
    AsyncStorage.getItem(LIT_SNAPSHOT_KEY)
      .then((raw) => {
        if (!alive) return
        const snap = raw
          ? (JSON.parse(raw) as { date: string; lit: Record<string, boolean> })
          : null
        const prev = snap && snap.date === today ? snap.lit : {}
        const newly = dims
          .filter((d) => d.key !== 'ciclo' && current[d.key] && !prev[d.key])
          .map((d) => d.key)
        if (newly.length) setIgnited(newly)
        void AsyncStorage.setItem(LIT_SNAPSHOT_KEY, JSON.stringify({ date: today, lit: current }))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [signals, calorieTarget, proteinTarget, cycleEnabled])

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
          body="Registra algo: una comida, tu sueño de anoche, un entreno, un vaso de agua. Cualquier señal vale."
          hint="Cuando haya algo registrado, esta pantalla se transforma en tu lectura."
        />
      </Animated.View>
    )
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      {/* Header — a REAL one-word identity for today, derived from the live
          dimensions (same shared lib the orbital + the BE use). The meta
          line is the honest count of dimensions en luz right now. Below it,
          the deterministic reading is the real, honest lede (states today's
          facts, verifiable by tapping the stars). No mock here. */}
      <View style={styles.header}>
        <EmText
          text={dayHeader.name}
          emphasis={dayHeader.emphasis}
          style={styles.archetype}
          emStyle={styles.archetypeEm}
        />
        <View style={styles.metaRow}>
          <LiveDot />
          {/* A QUALITATIVE state of today's sky — never a raw count. A bare
              number with no denominator reads as a score ("5, me falta 1"),
              which the manifesto forbids; the orbital already shows how many
              shine. So we name the mood by range, no magenta, no number. */}
          <Text style={styles.metaB} numberOfLines={1}>
            {dayHeader.enLuz === 0
              ? 'Aún sin registrar hoy'
              : dayHeader.enLuz <= 2
                ? 'Tu día empieza a tomar forma'
                : dayHeader.enLuz <= 4
                  ? 'Tu día va tomando forma'
                  : 'Un día con mucha señal'}
          </Text>
        </View>
      </View>

      {/* Arrival payoff — what newly lit TODAY (P2A). Snapshot resets at
          midnight (today-pure): el Día nunca compara con otra jornada. */}
      {ignited.length > 0 ? (
        <Animated.Text entering={FadeIn.duration(600)} style={styles.ignited}>
          {ignited.length === 1
            ? `✦ Encendiste ${LIT_PHRASE[ignited[0]!] ?? 'una luz'} en tu cielo.`
            : '✦ Encendiste nuevas luces en tu cielo.'}
        </Animated.Text>
      ) : null}

      {/* Hero — the orbital diagram takes the full bleed. The
          right-side six-dimension node list was retired: with each
          star now carrying its own colors.dimension halo + an on-orbital
          serif mini-label, the column was duplicating info, eating
          ~35 % horizontal real estate and clipping the focus label
          behind the panel. Discovery now lives inside the orbital
          (mini-labels at rest, glyph + "tu cuerpo / tu sueño /..."
          when zoomed in). */}
      <View style={styles.heroRow}>
        {/* CosmicParticles REMOVED from heroRow — it was bound inside
            heroRow as an absoluteFill, which meant its top edge sat
            exactly at the heroRow's top boundary. The user perceived
            this as a "line": above heroRow only SkyBackground particles
            were visible; below heroRow the additional CosmicParticles
            layer thickened the atmosphere visibly, creating the edge.
            The ScreenCosmos layer at the page root (app/(tabs)/orbit.tsx)
            already spans the whole screen with stars + nebulae — the
            extra in-row particles were redundant. The transition into
            the orbital is now continuous. */}
        <OrbitalSystem
          dimensions={dimensions}
          selectedKey={selectedKey}
          onSelect={(k) => setSelectedKey((cur) => (cur === k ? null : k))}
        />
        {/* Bottom fade — el fondo (SkyBackground + ScreenCosmos) es
            CONTINUO a pantalla completa, así que el orbital ya se asienta
            sobre él sin discontinuidad. El gradiente anterior terminaba en
            `#1A0810` OPACO en su borde inferior y chocaba de golpe con ese
            fondo continuo → una línea horizontal dura. Ahora difumina a
            transparente en AMBOS extremos: una bruma vino suave en el
            tercio bajo del orbital, sin borde duro — el fondo retoma sin
            escalón. */}
        <LinearGradient
          colors={['transparent', '#1A0810', 'transparent']}
          locations={[0, 0.5, 1]}
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
            {/* Exit affordance — the focused star is hidden behind the
                halo so tapping it again to deselect is invisible to
                the user. A subtle close glyph in the corner gives an
                obvious way back to the full orbital. */}
            <Pressable
              onPress={() => setSelectedKey(null)}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel="Cerrar lectura"
              style={styles.closeBtn}
            >
              <Text style={styles.closeGlyph}>✕</Text>
            </Pressable>
            {/* Header — eyebrow + dimension word. The earlier `selectedTone`
                pill on the right ("brillante" / "en formación" / "en
                silencio") was redundant with `selected.word` ("clara" /
                "alta" / "calma") which is the same state in Stelar
                voice — and the two competed semantically (UX audit:
                "MENTE · clara · brillante" delivered two positive
                labels in different registers). Removed in favour of
                the single coach-voice `word`; the tone is still
                conveyed implicitly via detail line + evidence presence.
                Bonus: the close ✕ no longer collides with the pill. */}
            <View style={styles.readoutTop}>
              <View style={styles.readoutLabelRow}>
                <Text style={styles.readoutLabel}>{selected.label}</Text>
                {selected.word ? <Text style={styles.readoutWord}>{selected.word}</Text> : null}
              </View>
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
            ) : selected.key === 'ciclo' && signals != null ? null : ( // actionable. // the truth. No CTA either — outside-of-period is not // Skip the silence block entirely; the detail line carries // ("la app no me lee" / "reproche disfrazado" per UX audit). // no inventa." here contradicted the factual detail line // signal — showing "Aún no hay señal aquí. Stelar espera, // CICLO with "Fuera del periodo" is a FACT, not a missing
              <View style={styles.silence}>
                <Text style={styles.evidenceQuiet}>
                  {QUIET_LINE_FOR[selected.key] ??
                    'Aún no hay señal aquí. Stelar espera, no inventa.'}
                </Text>
                {AFFORD_TEXT[selected.key] ? (
                  <Pressable
                    onPress={() => {
                      const slide = SLIDE_FOR_DIM[selected.key]
                      router.push(slide ? `/(tabs)?slide=${slide}` : '/(tabs)')
                    }}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={AFFORD_TEXT[selected.key]}
                    style={styles.afford}
                  >
                    <Text style={styles.affordText}>{AFFORD_TEXT[selected.key]} →</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </Animated.View>
        ) : null}
      </View>

      {/* Voz de Stelar (PRD V1) — la traducción humana de los datos de
          HOY: frase 1 = qué registraste; frase 2 = qué sigue en calma.
          Factual, sin tendencias, siempre visible (responde "qué me
          falta" sin tocar una estrella). */}
      <View style={styles.voz}>
        <Text style={styles.vozEyebrow}>Voz de Stelar</Text>
        <Text style={styles.vozRegistered}>{voz.registered}</Text>
        {voz.missing ? <Text style={styles.vozMissing}>{voz.missing}</Text> : null}
      </View>

      {/* Hoy en vivo — today's live, goal-aware readings. Real + always
          on (independent of the mock engine). */}
      <DayLiveReadings cards={dayReadings} />

      {/* AI prose — the recommended move + Voz de Stelar. Hidden while
          the engine is mock; the deterministic reading above is the real
          voice for now. Returns when ENGINE_ACTIVE flips true. */}
      {ENGINE_ACTIVE ? (
        <>
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
        </>
      ) : null}
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
    // Más alto + difuminado a ambos lados → pendiente suave, sin borde.
    height: 200,
  },
  // Readout overlay — translucent panel anchored to the bottom of
  // the orbital container. Replaces the old below-the-hero card so
  // the info lands within the same eyeline as the focus cinematic.
  //
  // Bg lowered 0.82 → 0.62 alpha + bronze hairline top REMOVED
  // (user-reported visible "line" where the card began). The card
  // now reads as a soft pool of wine emerging FROM the sky rather
  // than a panel pasted ON it. The orbital + heroFade gradient
  // beneath blend through cleanly with no edge break.
  readoutOverlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 18,
    backgroundColor: 'rgba(20, 8, 18, 0.62)',
    borderRadius: 16,
    padding: 16,
    gap: 10,
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
  // The header's meta line — a LiveDot + the honest count of dimensions
  // en luz right now. The live dot keeps the "Stelar is reading you"
  // presence.
  metaRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  metaB: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  // Voz de Stelar — la lectura factual de hoy. Centrada como el resto de
  // la voz del coach. Registrado en leche; faltante en niebla (más callado).
  voz: {
    marginTop: 22,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  vozEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 10,
  },
  vozRegistered: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 19,
    lineHeight: 27,
    color: colors.leche,
    textAlign: 'center',
  },
  vozMissing: {
    marginTop: 7,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15.5,
    lineHeight: 22,
    color: colors.niebla,
    textAlign: 'center',
  },
  // The one-time first-reading reveal, above the Voz de Stelar card.
  revealIntro: {
    marginTop: 22,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  revealEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
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
    fontSize: typography.sizes.micro,
    color: colors.leche,
    letterSpacing: 1.6,
  },
  // The poetic word — serif italic magenta, like the archetype.
  readoutWord: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.magenta,
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
    fontSize: typography.sizes.tinyLabel,
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
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  evidenceDot: {
    marginHorizontal: 6,
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.bruma,
  },
  evidenceValue: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
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
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
  },
  // Arrival payoff — the line that celebrates a newly-lit dimension.
  ignited: {
    marginTop: 12,
    textAlign: 'center',
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.oro,
  },
  // Silence block — the honest line + the oro afford that invites the
  // user to register the signal that lights this dimension.
  silence: {
    gap: 8,
  },
  // CTA pill — was a bare text link that lost weight under the halo's
  // visual mass. Outlined pill with the oro hue ties it back to the
  // coach-warm palette without becoming a loud filled button (manifesto:
  // calm, not gym-app). hitSlop 12 lifts the touch target above 44 pt.
  afford: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.oro,
  },
  affordText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.oro,
    letterSpacing: 0.2,
  },
  // Exit affordance for the focused state — absolute top-right of the
  // readout overlay so it never crowds the readoutTop label/state row.
  // Cream colour at low opacity so it reads as a gentle "out" cue,
  // not a destructive close.
  closeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: 8,
    zIndex: 2,
  },
  closeGlyph: {
    fontFamily: typography.ui,
    fontSize: 18,
    color: colors.leche,
    opacity: 0.55,
    lineHeight: 18,
  },
})
