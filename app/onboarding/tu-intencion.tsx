import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, Ellipse, G, RadialGradient, Stop } from 'react-native-svg'

import {
  AtmosphericSky,
  DustMote,
  StepHeader,
  WarmBloomField,
  WizardLayout,
} from '@/features/onboarding/components'
import { type MonthlyFocus } from '@/features/profile/api'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)

/** A single intention option with a short, low-key descriptor. The
 *  descriptor sits below the label so each card carries actual
 *  weight — not a flat one-word chip. */
type IntentOption = {
  value: MonthlyFocus
  label: string
  tagline: string
}

// PRUNED to 5 (manifiesto v3.0 — foco quirúrgico en peso). "Bajar de
// peso" leads as the outcome bucket; the rest name the dimensions that
// SOSTAIN the outcome (energy, the food↔pattern link, patterns, other).
// Three options were retired FROM THE UI ONLY — `sleep`, `cycle`, `mind`:
//   • `mind` ("Calmar la ansiedad") cruza la línea roja clínica (Stelar
//     NO trata ansiedad) y no ladder-up a peso.
//   • `sleep` ("Dormir mejor") el manifiesto lo excluye como objetivo.
//   • `cycle` ("Leer mi ciclo") ya se captó en el paso de ciclo (step 8).
// Those three values STAY in the MONTHLY_FOCUS_VALUES enum (legacy/test
// data uses them) — we just stop OFFERING them here. No migration.
const FOCUS_OPTIONS: readonly IntentOption[] = [
  {
    value: 'weight',
    label: 'Bajar de peso',
    tagline: 'Stelar trabaja para que se sostenga.',
  },
  {
    value: 'energy',
    label: 'Recuperar mi energía',
    tagline: 'De tu energía nace la constancia.',
  },
  {
    value: 'food',
    label: 'Entender cómo me alimento',
    tagline: 'Qué se repite alrededor de comer.',
  },
  { value: 'patterns', label: 'Entender mis patrones', tagline: 'Qué hace los viernes distintos.' },
  { value: 'other', label: 'Algo más', tagline: 'La nombras tú.' },
]

/** Phrase Stelar quietly utters after the user picks an intention. A
 *  quiet acknowledgment beat — Stelar confirma que escuchó, sin
 *  celebrar. No reward, no fanfare: just "yes, I have it".
 *
 *  Keyed on the FULL MonthlyFocus enum (TS requires every key). The
 *  `sleep` / `cycle` / `mind` entries are INERT — no longer reachable
 *  from the UI (the options were pruned, see FOCUS_OPTIONS) — but they
 *  stay so the Record<MonthlyFocus, string> type has no holes and legacy
 *  rows (which may still carry those values) don't crash the lookup. */
const FOCUS_CELEBRATION: Record<MonthlyFocus, string> = {
  weight: 'Stelar te acompaña a sostenerlo.',
  energy: 'Stelar busca de dónde nace tu fuerza.',
  food: 'Stelar mira el qué y el cuándo de cada comida.',
  patterns: 'Stelar observa qué se repite en ti.',
  other: 'Stelar lo guarda y se ajusta a ti.',
  // ── Inert: pruned from the UI, kept for enum completeness. ──
  sleep: 'Stelar mide cómo descansas para que el cuerpo suelte.',
  cycle: 'Stelar lee tu ciclo junto a todo lo demás.',
  mind: 'Stelar afina la lectura hacia tu mente.',
}

/*
 * Step 10 — Tu objetivo. MULTI-SELECT con PRIORIDAD. Stelar C is a
 * weight-loss app with emotional intelligence; the framing makes that
 * honest. "Bajar de peso" is the headline option (the outcome bucket);
 * the rest name the dimensions that SOSTAIN the outcome (energy, the
 * food-emotion link, patterns, other).
 *
 * The user can pick MORE THAN ONE — `selected` is an ORDERED array in
 * order of selection. The FIRST element (`selected[0]`) is the PRIORITY:
 * the one that drives the engine (persisted to profile.monthly_focus)
 * and the one marked with a micro "TU PRIORIDAD" eyebrow. The secondary
 * picks are remembered in-state (and acknowledged visually with the same
 * magenta treatment, minus the priority marker) but NOT persisted yet —
 * there's no column for them. Tap a card to add; tap again to remove. If
 * the priority is removed, the next selection slides up to become it.
 *
 * Selection still drives the same MonthlyFocus enum + calcMacros logic
 * via selected[0] — the engine is untouched.
 *
 * Persisted to profile.monthly_focus. After Continuar fires in the
 * wizard, a quiet acknowledgment overlay confirms Stelar received it
 * (a still bloom + the phrase, no celebration of the answer). When
 * opened from Ajustes we skip the overlay entirely — editing a
 * preference is not a milestone — and pop straight back after saving.
 *
 * ATMOSPHERE PARITY (illustrator pass — same line as steps 1–9): the
 * screen paints a full-screen sky so it breathes with the rest of the
 * wizard. The tint is WARM MAGENTA because the theme is intención /
 * fuerza — the antithesis of step 9's cold sleep sky:
 *   • AtmosphericSky glow pulled to cx50%/cy30% (centred-HIGH) so two
 *     consecutive screens don't share the same off-frame sun (step 9
 *     used 42%/38%).
 *   • WarmBloomField variant="exposed" — REUSED. Step 8 used
 *     'exposed-low-right', step 9 'exposed-low-left'; 'exposed' here
 *     doesn't chain with the immediate neighbour (no new variant).
 *   • IntencionSky — a warm-tinted clone of step 9's RitmoSky: the
 *     micro-stars + low wisp carry magenta instead of indigo, with a
 *     SECOND smaller wisp breathing in counter-phase for painted vapor.
 *
 * EDGE FADES (elevation pass): the ScrollView sits inside a flex
 * container with two bg-coloured gradient overlays (top + bottom,
 * pointerEvents none) so the cards EMERGE from the sky and dissolve
 * into it instead of clipping in a hard line. The fades use colors.bg
 * (#0A0608), never bgCard, so they read as atmosphere, not a panel.
 *
 * Four clocks. dotClock (8 s, ping-pong) drives the resting breath of
 * every IntentCard's dot. Three atmosphere clocks (5 s / 18 s / 40 s)
 * match steps 1–9's compás. All created ONCE here (one compás, no
 * duplicated shared values).
 */
export default function TuIntencionScreen() {
  const router = useRouter()
  // Opened from Ajustes (?source=settings) → save and pop back to
  // Settings; otherwise this is the onboarding wizard → advance to
  // notificaciones after the acknowledgment beat.
  const { source } = useLocalSearchParams<{ source?: string }>()
  const fromSettings = source === 'settings'
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()

  // Ordered selection: selected[0] is the PRIORITY (the one that drives
  // the engine + carries the "TU PRIORIDAD" marker). Seeded from the
  // persisted monthly_focus (single value → single-element array) so
  // re-entering from Ajustes restores the priority. Secondary picks were
  // never persisted, so they start empty on re-entry.
  const [selected, setSelected] = useState<MonthlyFocus[]>(() => {
    const persisted = profile?.monthly_focus as MonthlyFocus | null | undefined
    // Only seed if the persisted value is one we still OFFER — a legacy
    // row carrying a pruned value (sleep/cycle/mind) would otherwise show
    // no selected card while pretending one exists.
    return persisted && FOCUS_OPTIONS.some((o) => o.value === persisted) ? [persisted] : []
  })

  // The screen already names itself; we drop any per-name suffix for a
  // clean eyebrow (parity with tu-ritmo step 9).
  const eyebrow = 'Tu objetivo'

  const canContinue = selected.length > 0
  const priority = selected[0] ?? null
  const [celebrating, setCelebrating] = useState(false)

  // The post-acknowledgment navigation timer. Held in a ref so it is
  // cleared on unmount — otherwise a fast back/teardown during the 1.1 s
  // beat would fire router.push on an unmounted screen (phantom nav).
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (navTimer.current) clearTimeout(navTimer.current)
    },
    [],
  )

  // dotClock — slow 8 s ping-pong breath driving the resting state of
  // every IntentCard's presence dot so the column reads as alive.
  const dotClock = useSharedValue(0)

  // Atmosphere clocks — created ONCE here so every atmosphere layer
  // (WarmBloomField, star strata + dust + warm wisps) breathes on the
  // SAME values (same periods as steps 1–9 → same compás):
  //   clock  5 s  warm-field breath
  //   dust  18 s  cosmic-dust drift + warm-wisp breath
  //   orbit 40 s  star-strata parallax
  const clock = useSharedValue(0)
  const dust = useSharedValue(0)
  const orbit = useSharedValue(0)

  useEffect(() => {
    dotClock.value = withRepeat(
      withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    clock.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false)
    dust.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.linear }), -1, false)
    orbit.value = withRepeat(withTiming(1, { duration: 40000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(dotClock)
      cancelAnimation(clock)
      cancelAnimation(dust)
      cancelAnimation(orbit)
    }
  }, [dotClock, clock, dust, orbit])

  // Toggle in ORDER. Tap an unselected card → append (becomes the new
  // last pick; if the column was empty it also becomes the priority).
  // Tap a selected card → remove it; if it was the priority, the next
  // pick in order slides up to become the new priority automatically
  // (array order is preserved by the filter).
  const handleToggle = (next: MonthlyFocus) => {
    // selectionAsync — the only haptic this screen fires. The pick IS
    // the moment of feedback; the acknowledgment overlay stays silent.
    Haptics.selectionAsync().catch(() => {})
    setSelected((prev) => (prev.includes(next) ? prev.filter((v) => v !== next) : [...prev, next]))
  }

  const handleContinue = () => {
    if (!canContinue || !priority) return

    // From Ajustes: editing a preference is not a milestone. Save and
    // pop straight back — no acknowledgment overlay, no haptic flourish.
    // We persist the PRIORITY (selected[0]) as monthly_focus — the engine
    // contract is unchanged.
    // TODO: persistir selected[1..] requiere columna nueva (backend) para
    // que la Voz use el contexto secundario.
    if (fromSettings) {
      updateProfile.mutate(
        { monthly_focus: priority },
        {
          onSuccess: () => router.back(),
        },
      )
      return
    }

    // Wizard flow: quiet acknowledgment beat, then advance. No Success
    // notification haptic — the selectionAsync on pick already gave the
    // tactile feedback, and a Success buzz would dramatise the answer.
    // Only the priority is persisted (monthly_focus = selected[0]); the
    // secondaries are not stored yet (no column).
    // TODO: persistir selected[1..] requiere columna nueva (backend) para
    // que la Voz use el contexto secundario.
    setCelebrating(true)
    updateProfile.mutate(
      { monthly_focus: priority },
      {
        onSuccess: () => {
          navTimer.current = setTimeout(() => {
            router.push('/onboarding/notificaciones')
          }, 1100)
        },
        onError: () => setCelebrating(false),
      },
    )
  }

  return (
    <>
      <WizardLayout
        step={10}
        totalSteps={12}
        canContinue={canContinue}
        loading={updateProfile.isPending}
        errorMessage={updateProfile.error?.message}
        onContinue={handleContinue}
        continueLabel="Continuar"
        ctaVariant="soft"
        ctaTransform="none"
        atmosphere={
          <>
            {/* 1. Shared warm glow — centred-HIGH (cx50%/cy30%) so the
                warmth sits behind the question, distinct from step 9's
                42%/38% off-frame sun. */}
            <AtmosphericSky glow={{ cx: '50%', cy: '30%', r: '70%' }} />
            {/* 2. Deep warm atmosphere — REUSED 'exposed' (step 8 used
                'exposed-low-right', step 9 'exposed-low-left'; 'exposed'
                here doesn't chain with the immediate neighbour — no new
                variant authored). */}
            <WarmBloomField clock={clock} variant="exposed" />
            {/* 3. Painted depth — WARM MAGENTA star strata + dust + two low
                warm wisps in counter-phase, full-screen, whisper-low, hidden
                from VoiceOver. Tinted toward intención / fuerza. */}
            <IntencionSky dust={dust} orbit={orbit} />
          </>
        }
      >
        {/* Scroll stage — the ScrollView plus two bg-coloured edge fades so
            the card column emerges from the sky at the top and dissolves
            back into it at the bottom (over the CTA). The fades are absolute
            siblings with pointerEvents none, so they never intercept taps and
            the cards keep scrolling + remaining tappable underneath. */}
        <View style={styles.scrollStage}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <StepHeader
              eyebrow={eyebrow}
              eyebrowColor="magenta"
              question="¿Qué quieres lograr?"
              questionEmphasis="lograr"
              hint="Elige una o varias. La primera es donde Stelar pone el foco."
            />

            {/* Multi-select group — the cards form a logical group of
                CHECKBOXES (no longer a radiogroup: more than one can be
                checked at once). VoiceOver reads each card's checked state;
                the priority card adds " · tu prioridad" to its label. */}
            <View
              style={styles.list}
              // RN has no "group" AccessibilityRole (web-only token). The
              // label alone groups the checkboxes for VoiceOver; each card
              // carries its own role="checkbox" + checked state.
              accessibilityLabel="¿Qué quieres lograr? Elige una o varias; la primera es tu prioridad."
            >
              {FOCUS_OPTIONS.map((opt, index) => {
                const isSelected = selected.includes(opt.value)
                const isPriority = priority === opt.value
                const isAnySelected = selected.length > 0
                return (
                  <IntentCard
                    key={opt.value}
                    option={opt}
                    // index 1 ('energy') opens the block of "what SUSTAINS the
                    // outcome" — it carries extra top breathing room so card 0
                    // ('Bajar de peso', the objective) reads as its own beat.
                    separated={index === 1}
                    selected={isSelected}
                    priority={isPriority}
                    dim={isAnySelected && !isSelected}
                    onPress={() => handleToggle(opt.value)}
                    clock={dotClock}
                  />
                )
              })}
            </View>
          </ScrollView>

          {/* Top edge fade — bg (#0A0608) → transparent, pegado bajo el
              StepHeader. The cards emerge from the sky here. */}
          <LinearGradient
            colors={[colors.bg, 'rgba(10, 6, 8, 0)']}
            style={styles.fadeTop}
            pointerEvents="none"
          />
          {/* Bottom edge fade — transparent → bg (#0A0608), pegado al fondo
              del área scrolleable (sobre el CTA). The cards dissolve into the
              sky rather than clipping in a hard line. */}
          <LinearGradient
            colors={['rgba(10, 6, 8, 0)', colors.bg]}
            style={styles.fadeBottom}
            pointerEvents="none"
          />
        </View>
      </WizardLayout>

      {/* Acknowledgment beat — full-screen overlay (outside WizardLayout
          so it covers the safe area + CTA too). A single still bloom +
          the phrase, NOT a celebration of the answer. The phrase keys off
          the PRIORITY (selected[0]). Choreographed over 1.1 s:
            t=0    veil fades in + body starts bloom (320 ms)
            t=560  phrase fades in + settles up (translateY 6→0)
            t=1100 navigation fires (exit fade-out kicks in)
          The body keeps a slow breath through the moment so it doesn't
          feel frozen while the text reads. The veil is translucent so the
          atmosphere is intuited behind it. Skipped entirely from Ajustes. */}
      {celebrating && priority ? (
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(280)}
          pointerEvents="none"
          style={styles.celebOverlay}
        >
          <View style={styles.celebInner}>
            <CelebrationBody />
            <CelebrationPhrase text={FOCUS_CELEBRATION[priority]} />
          </View>
        </Animated.View>
      ) : null}
    </>
  )
}

/* ─────────────────────── Card ─────────────────────── */

/** One intention card. The idle treatment is ALWAYS the solid bgCard +
 *  hairline (legibility over the cosmic backdrop); selection is layered
 *  on top as a 200 ms OPACITY crossfade rather than a binary style swap
 *  — parity with tu-ritmo's TrainingCard. With multi-select, SEVERAL
 *  cards can be `selected` (magenta glow) at once — each card reads its
 *  OWN `selected`/`priority` props, so the per-card animations are fully
 *  independent. Three absoluteFill layers fade IN on a per-card `glow`
 *  shared value:
 *    (a) shadow layer — static magenta iOS shadow, opacity-crossfaded;
 *    (b) magenta fill 0.12;
 *    (c) magenta 1 px border.
 *  All three share the EXACT borderRadius (16) of the idle card so no
 *  corner peeks out as they fade. The scale spring, the text slide and
 *  the dot breath (on dotClock) are unchanged.
 *
 *  `priority` (selected[0]) adds a micro magenta "TU PRIORIDAD" eyebrow
 *  above the card — text only, never a halo/badge — so it can sit over
 *  ANY option (it is not specific to "Bajar de peso"). The other selected
 *  cards get the magenta treatment WITHOUT the marker.
 *
 *  `separated` lifts the card with extra marginTop + a partial-width
 *  hairline above it, separating "el objetivo" (card 0) from "lo que lo
 *  sostiene" (cards 1+) by SPACE, not decoration (manifesto: no
 *  halo/badge around the weight option). */
function IntentCard({
  option,
  separated,
  selected,
  priority,
  dim,
  onPress,
  clock,
}: {
  option: IntentOption
  separated: boolean
  selected: boolean
  priority: boolean
  dim: boolean
  onPress: () => void
  clock: SharedValue<number>
}) {
  // Scale spring — the tactile bounce on selection.
  const scale = useSharedValue(1)
  useEffect(() => {
    scale.value = withSpring(selected ? 1.02 : 1, { damping: 16, stiffness: 220 })
    return () => cancelAnimation(scale)
  }, [selected, scale])

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  // Glow crossfade — the selected card's magenta treatment fades IN/OUT
  // on OPACITY (200 ms / ease-out-quad). We never animate
  // shadowRadius/shadowOpacity or border/fill colors numerically;
  // dedicated layers carry the static look and only their opacity tweens.
  const glow = useSharedValue(selected ? 1 : 0)
  useEffect(() => {
    glow.value = withTiming(selected ? 1 : 0, { duration: 200, easing: Easing.out(Easing.quad) })
    return () => cancelAnimation(glow)
  }, [selected, glow])
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }))

  // Label slides 4 px to the right when claimed.
  const textStyle = useAnimatedStyle(() => {
    'worklet'
    return { transform: [{ translateX: selected ? 4 : 0 }] }
  })

  // Tagline reveal — at rest the descriptor is a quiet 0.92 (legible:
  // it carries the content that helps the user choose); on
  // selection it climbs to full presence (1) so the chosen line "se
  // revela". Opacity only, numeric, UI-thread safe.
  const taglineStyle = useAnimatedStyle(() => {
    'worklet'
    return { opacity: selected ? 1 : 0.92 }
  })

  // Idle dots breathe; selected dots ignite + grow.
  const dotStyle = useAnimatedStyle(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    const s = selected ? 1.25 : 1
    // The selected dot breathes a touch deeper (×0.12) so the live answer
    // pulses just above the resting column (still ×0.08). Numeric scale.
    const breathDepth = selected ? 0.12 : 0.08
    return {
      transform: [{ scale: s * (1 + b * breathDepth) }],
      // dim 0.30 (was 0.18): the non-selected options must read as
      // "still available if I picked wrong", not "closed / discarded".
      opacity: selected ? 1 : dim ? 0.3 : 0.42 + b * 0.12,
    }
  })

  // Accessibility label — the priority card appends " · tu prioridad" so
  // VoiceOver distinguishes the engine-driving pick from the secondaries.
  const a11yLabel = priority ? `${option.label} · tu prioridad` : option.label

  return (
    <View style={separated ? styles.separatedGroup : undefined}>
      {/* Aliento — a partial-width, ultra-faint hairline that gives card 0
          its own breathing room above the sustaining block. Spacing, not a
          divider: ~40% width, centred, so it reads as breath, not a list
          split. Only rendered for the separated card. */}
      {separated ? <View style={styles.aliento} /> : null}

      {/* TU PRIORIDAD — micro magenta eyebrow over whichever card is the
          priority (selected[0]). Text only — NO halo/badge — so it can sit
          over any option without dramatising it (manifesto-safe even on
          "Bajar de peso"). */}
      {priority ? <Text style={styles.priorityMark}>TU PRIORIDAD</Text> : null}

      <Animated.View style={[styles.cardOuter, cardStyle]}>
        <Pressable
          onPress={onPress}
          accessibilityRole="checkbox"
          accessibilityLabel={a11yLabel}
          accessibilityState={{ checked: selected }}
          android_ripple={{ color: 'rgba(217, 39, 102, 0.18)', borderless: false }}
          style={({ pressed }) => [pressed && styles.cardPressed]}
        >
          {/* Idle card — ALWAYS solid bgCard + hairline so the label stays
              legible over the cosmic backdrop regardless of selection. */}
          <View style={styles.card}>
            {/* (a) Shadow layer — static magenta iOS shadow, crossfaded by
                opacity. Behind the content so the halo blooms under the card. */}
            <Animated.View style={[styles.cardGlowShadow, glowStyle]} pointerEvents="none" />
            {/* (b) Magenta fill — 0.12 tint, crossfaded in. */}
            <Animated.View style={[styles.cardGlowFill, glowStyle]} pointerEvents="none" />
            {/* (c) Magenta border — 1 px, crossfaded in over the hairline. */}
            <Animated.View style={[styles.cardGlowBorder, glowStyle]} pointerEvents="none" />

            <Animated.View
              style={[styles.dot, selected ? styles.dotOn : styles.dotOff, dotStyle]}
            />
            <Animated.View style={[styles.textCol, textStyle]}>
              <Text style={[styles.label, selected && styles.labelOn]}>{option.label}</Text>
              <Animated.Text style={[styles.tagline, selected && styles.taglineOn, taglineStyle]}>
                {option.tagline}
              </Animated.Text>
            </Animated.View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  )
}

/* ─────────────────────── CelebrationPhrase ─────────────────────── */

/** The acknowledgment phrase. Fades in late (delay 560 ms) AND settles
 *  upward (translateY 6 → 0) so it "se asienta" rather than popping. The
 *  FadeIn carries the opacity; a dedicated shared value carries the
 *  translate so we never animate it as a string. */
function CelebrationPhrase({ text }: { text: string }) {
  const lift = useSharedValue(6)
  useEffect(() => {
    lift.value = withTiming(0, { duration: 460, easing: Easing.out(Easing.cubic) })
    return () => cancelAnimation(lift)
  }, [lift])

  const liftStyle = useAnimatedStyle(() => {
    'worklet'
    return { transform: [{ translateY: lift.value }] }
  })

  return (
    <Animated.Text entering={FadeIn.duration(420).delay(560)} style={[styles.celebText, liftStyle]}>
      {text}
    </Animated.Text>
  )
}

/* ─────────────────────── CelebrationBody ─────────────────────── */

/** A small cosmic body that blooms in and breathes — the visual half of
 *  the acknowledgment beat. Same vocabulary as the rest of the wizard
 *  (a single RadialGradient bloom + a white-hot core), DISTILLED down
 *  from an earlier fireworks burst: no sparks, no rays, no diagonal
 *  spikes. Stelar confirms it heard the choice; it does not celebrate it
 *  (the manifesto forbids dramatising any answer, weight included). */
const CELEB_W = 220
const CELEB_H = 200
const CELEB_CX = CELEB_W / 2
const CELEB_CY = CELEB_H / 2

function CelebrationBody() {
  // Slow breath keeps the body alive during the whole 1.1 s moment.
  const breath = useSharedValue(0)
  // Bloom value rises 0 → 1 in the first 320 ms (the body grows in).
  const bloom = useSharedValue(0)

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    bloom.value = withTiming(1, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    })
    return () => {
      cancelAnimation(breath)
      cancelAnimation(bloom)
    }
  }, [breath, bloom])

  // Bloom — single RadialGradient circle whose radius + overall opacity
  // ride bloom (entrance) + breath (ongoing).
  const bloomProps = useAnimatedProps(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(breath.value * 2 * Math.PI)
    return {
      r: 24 + bloom.value * 26 + b * 3,
      opacity: 0.45 + bloom.value * 0.45 + b * 0.06,
    }
  })
  const coreProps = useAnimatedProps(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(breath.value * 2 * Math.PI)
    return {
      r: 3.4 + bloom.value * 2.2 + b * 0.3,
    }
  })

  return (
    <Svg width={CELEB_W} height={CELEB_H}>
      <Defs>
        <RadialGradient id="celeb-core" cx="50%" cy="50%" r="60%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="40%" stopColor="#FBD7E3" />
          <Stop offset="100%" stopColor={colors.magenta} />
        </RadialGradient>
        <RadialGradient id="celeb-bloom" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={colors.magenta} stopOpacity={0.7} />
          <Stop offset="40%" stopColor={colors.magenta} stopOpacity={0.26} />
          <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Atmospheric bloom — RadialGradient-filled circle, no ring edges.
          Radius pulses with breath. */}
      <AnimatedCircle
        cx={CELEB_CX}
        cy={CELEB_CY}
        fill="url(#celeb-bloom)"
        animatedProps={bloomProps}
      />

      {/* Core — white-hot gradient. */}
      <AnimatedCircle
        cx={CELEB_CX}
        cy={CELEB_CY}
        fill="url(#celeb-core)"
        animatedProps={coreProps}
      />
    </Svg>
  )
}

/* ───────────────────── Full-screen star sky ────────────────────── */

// Star strata — a WARM clone of step 9's RitmoSky, tinted toward magenta
// (intención / fuerza). x/y are 0→1 fractions of the screen; parallax
// amplitude grows toward the viewer (far 2px / mid 5px / micro 9px).
// Concentrated in the LOWER half so the depth pools under the cards,
// never behind their text. The band is held to y≥0.58 (same as step 9)
// so a xMidYMid slice on a tall viewport keeps stars clear of the stack.
// Alphas are IDENTICAL to RitmoSky's — only the tint changed.
const FAR_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.1, y: 0.58, r: 0.6, opacity: 0.1 },
  { x: 0.92, y: 0.6, r: 0.7, opacity: 0.12 },
  { x: 0.74, y: 0.74, r: 0.6, opacity: 0.1 },
  { x: 0.5, y: 0.87, r: 0.5, opacity: 0.08 },
]

const MID_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.16, y: 0.62, r: 0.8, opacity: 0.24 },
  { x: 0.9, y: 0.76, r: 0.9, opacity: 0.26 },
  { x: 0.12, y: 0.78, r: 0.8, opacity: 0.24 },
  { x: 0.62, y: 0.66, r: 0.7, opacity: 0.2 },
]

// Micro-stars — nearest field, MAGENTA (intención accent), halo + parallax.
const MICRO_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.24, y: 0.68, r: 1.1, opacity: 0.42 },
  { x: 0.8, y: 0.7, r: 1.0, opacity: 0.38 },
  { x: 0.5, y: 0.76, r: 0.9, opacity: 0.34 },
  { x: 0.14, y: 0.89, r: 1.0, opacity: 0.36 },
  { x: 0.88, y: 0.8, r: 0.85, opacity: 0.3 },
  { x: 0.58, y: 0.9, r: 0.8, opacity: 0.28 },
]

// DUST — thinned to 4 motes, rising through the lower half. They whisper
// behind the cards without competing.
const DUST: {
  x: number
  baseR: number
  period: number
  sway: number
  opacity: number
  phase: number
}[] = [
  { x: 0.22, baseR: 0.9, period: 1.05, sway: 9, opacity: 0.36, phase: 0.1 },
  { x: 0.52, baseR: 1.0, period: 0.95, sway: 11, opacity: 0.42, phase: 0.5 },
  { x: 0.78, baseR: 0.7, period: 1.15, sway: 8, opacity: 0.32, phase: 0.3 },
  { x: 0.66, baseR: 0.75, period: 1.1, sway: 10, opacity: 0.28, phase: 0.2 },
]

/*
 * IntencionSky — full-screen painted depth for step 10. A WARM clone of
 * step 9's RitmoSky: three star strata + rising dust + two low warm wisps,
 * behind the content. The stars sit in the LOWER half (the cards own the
 * top, so the sky stays a whisper there). Differential parallax (2/5/9px)
 * on the 40 s orbit clock, dust + wisps on the 18 s clock. All whisper-low
 * alphas, pointerEvents none, hidden from VoiceOver.
 *
 * THEMATIC DIFFERENCE vs RitmoSky — the screen is about intención /
 * fuerza, so the sky tints toward magenta (colors.magenta) instead of
 * dimension.sueno indigo: the micro-stars and the low wisps carry magenta;
 * the far stratum is magenta very faintly; the mid stratum is a warm
 * cream-neutral (#E8D9DD) so the field reads quiet, not neon. Alphas are
 * UNCHANGED from RitmoSky — only the tint moved.
 *
 * WARM WISPS — a wide-and-low primary magenta ellipse at cy ~0.66 that
 * breathes 0.04↔0.06 on the dust clock, plus a SMALLER, fainter second
 * ellipse at cy ~0.78 that breathes in COUNTER-PHASE (1 − sin) on the SAME
 * dust clock (0.025↔0.04). Two layers crossing give painted-vapor depth.
 * Ambient only, NO free-floating focal star to celebrate any one answer.
 *
 * Parallax/twinkle move ONLY a numeric translate(px px) + opacity — never
 * an animated r/length as a string % (re-resolves against the viewport
 * every frame → jank). Gradient ids are namespaced `intencion-*` so they
 * cannot collide with step 9's `ritmo-*` / step 8's `ciclo-*` defs.
 */
function IntencionSky({ dust, orbit }: { dust: SharedValue<number>; orbit: SharedValue<number> }) {
  const SKY_W = 360
  const SKY_H = 760

  const farDriftProps = useAnimatedProps(() => {
    'worklet'
    const u = orbit.value * 2 * Math.PI
    return { transform: `translate(${Math.sin(u) * 2} ${Math.cos(u) * 2})` }
  })
  const midDriftProps = useAnimatedProps(() => {
    'worklet'
    const u = orbit.value * 2 * Math.PI
    return { transform: `translate(${Math.sin(u) * 5} ${Math.cos(u) * 5})` }
  })
  const microGroupProps = useAnimatedProps(() => {
    'worklet'
    const u = orbit.value * 2 * Math.PI
    const flicker = 0.85 + 0.15 * Math.sin(orbit.value * 2 * Math.PI * 3)
    return { transform: `translate(${Math.sin(u) * 9} ${Math.cos(u) * 9})`, opacity: flicker }
  })

  // ── Warm wisp breath ─────────────────────────────────────────────
  // A wide, low ellipse of magenta intención-light at cy 0.66 (media-baja).
  // It breathes between 0.04 and 0.06 on the 18 s dust clock — opacity
  // only (numeric, UI-thread safe). Reuses the shared dust clock, no new
  // shared value.
  const warmWispProps = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 + 0.5 * Math.sin(dust.value * 2 * Math.PI)
    return { opacity: 0.04 + w * 0.02 }
  })

  // ── Second warm wisp (counter-phase) ─────────────────────────────
  // A smaller, fainter ellipse lower down (cy 0.78), breathing on the SAME
  // dust clock but in COUNTER-PHASE (1 − sin). As the primary wisp swells,
  // this one recedes — two crossing layers give the lower half painted
  // vapor depth. Opacity only, numeric, reuses the shared dust clock (no
  // new shared value).
  const warmWisp2Props = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 - 0.5 * Math.sin(dust.value * 2 * Math.PI)
    return { opacity: 0.025 + w * 0.015 }
  })

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${SKY_W} ${SKY_H}`}
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          {/* Tight white falloff so micro-stars glow rather than read as
              flat drawn dots. Namespaced `intencion-*` to avoid collisions. */}
          <RadialGradient id="intencion-starGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          {/* Warm wisp — magenta intención, faint, falls off to nothing. */}
          <RadialGradient id="intencion-warmWisp" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.magenta} stopOpacity="0.06" />
            <Stop offset="1" stopColor={colors.magenta} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Warm wisp — wide-and-low ellipse at cy 0.66. Breathes faintly on
            the dust clock; depth without a free-floating focal point. */}
        <AnimatedEllipse
          cx={0.5 * SKY_W}
          cy={0.66 * SKY_H}
          rx={0.55 * SKY_W}
          ry={0.06 * SKY_H}
          fill="url(#intencion-warmWisp)"
          animatedProps={warmWispProps}
        />

        {/* Second warm wisp — smaller, lower (cy 0.78), counter-phase breath
            on the SAME dust clock. Reuses the warmWisp gradient. Painted
            vapor depth, no focal anchor. */}
        <AnimatedEllipse
          cx={0.5 * SKY_W}
          cy={0.78 * SKY_H}
          rx={0.35 * SKY_W}
          ry={0.045 * SKY_H}
          fill="url(#intencion-warmWisp)"
          animatedProps={warmWisp2Props}
        />

        {/* Cosmic dust rising through the lower half — magenta, dimmed. */}
        {DUST.map((d, i) => (
          <DustMote key={`sky-dust-${i}`} {...d} clock={dust} stage={SKY_H} fill={colors.magenta} />
        ))}

        {/* Far stars — distant stratum, faintly magenta, 2px parallax. */}
        <AnimatedG animatedProps={farDriftProps}>
          {FAR_STARS.map((s, i) => (
            <G key={`far-${i}`}>
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r * 2.4}
                fill="url(#intencion-starGlow)"
                opacity={s.opacity * 0.6}
              />
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r}
                fill={colors.magenta}
                opacity={s.opacity}
              />
            </G>
          ))}
        </AnimatedG>

        {/* Mid stars — middle depth, warm cream-neutral tint, 5px drift. */}
        <AnimatedG animatedProps={midDriftProps}>
          {MID_STARS.map((s, i) => (
            <Circle
              key={`mid-${i}`}
              cx={s.x * SKY_W}
              cy={s.y * SKY_H}
              r={s.r}
              fill="#E8D9DD"
              opacity={s.opacity}
            />
          ))}
        </AnimatedG>

        {/* Micro stars — nearest field, MAGENTA (intención accent), halo +
            9px parallax + group twinkle. Halo first so the point sits on a
            glow. */}
        <AnimatedG animatedProps={microGroupProps}>
          {MICRO_STARS.map((s, i) => (
            <G key={`micro-${i}`}>
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r * 2.5}
                fill="url(#intencion-starGlow)"
                opacity={0.15}
              />
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r}
                fill={colors.magenta}
                opacity={s.opacity}
              />
            </G>
          ))}
        </AnimatedG>
      </Svg>
    </View>
  )
}

/* ─────────────────────── Styles ─────────────────────── */

const styles = StyleSheet.create({
  // Scroll stage — flex container so the two edge fades can sit as absolute
  // siblings over the ScrollView (not over the CTA, which lives in
  // WizardLayout below this content slot).
  scrollStage: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  // Top edge fade — bg → transparent, ~28px, pinned under the StepHeader so
  // the card column emerges from the sky. pointerEvents none (set on the
  // element) so it never intercepts taps.
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
  },
  // Bottom edge fade — transparent → bg, ~40px, pinned to the bottom of the
  // scroll area (above the CTA) so the cards dissolve into the sky.
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  list: {
    marginTop: 24,
    // Inset horizontally so the selected card's magenta shadow has
    // room to project without being clipped by the ScrollView.
    paddingHorizontal: 14,
  },
  // Card 1 ('energy') opens the "lo que sostiene" block — extra top room
  // (18 vs the 10 normal cardOuter gap) sets the objective (card 0) apart
  // by SPACE. Distinction without decoration (no halo around the weight
  // option — manifesto).
  separatedGroup: {
    marginTop: 18,
  },
  // Aliento — partial-width, ultra-faint hairline above the separated card.
  // ~40% width, centred, half-strength hairline. Reads as breath, not a
  // divider that splits the list in two.
  aliento: {
    alignSelf: 'center',
    width: '40%',
    height: 1,
    backgroundColor: colors.hairline,
    opacity: 0.5,
    marginVertical: 14,
  },
  // TU PRIORIDAD — micro magenta eyebrow over the priority card. Uppercase,
  // tracked, tiny. Text only (no box/badge) so it marks the engine-driving
  // pick without dramatising any one option (manifesto-safe over weight).
  priorityMark: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 2.2,
    color: colors.magenta,
    marginBottom: 6,
    marginLeft: 2,
  },
  cardOuter: {
    marginBottom: 10,
  },
  cardPressed: {
    opacity: 0.92,
  },
  /* Intent card — the idle treatment is ALWAYS the solid bgCard + hairline
     (legibility over the cosmic backdrop); selection is layered on top via
     the glow layers below. The glow layers MUST match this borderRadius
     exactly (16) so no corner peeks. */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: colors.bgCard,
    borderColor: colors.hairline,
  },
  // (a) Shadow layer — static magenta iOS shadow, opacity-crossfaded by the
  // per-card glow value. backgroundColor stays transparent. borderRadius
  // matches `card` (16) so the halo blooms from the same rounded silhouette.
  cardGlowShadow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    backgroundColor: 'transparent',
    shadowColor: colors.magenta,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  // (b) Magenta fill — 0.12 tint, crossfaded in over the idle bg.
  cardGlowFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    backgroundColor: 'rgba(217, 39, 102, 0.12)',
  },
  // (c) Magenta border — 1 px, crossfaded in over the hairline.
  cardGlowBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.magenta,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 14,
  },
  dotOff: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  dotOn: {
    backgroundColor: colors.magenta,
    shadowColor: colors.magenta,
    shadowOpacity: 0.95,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  textCol: {
    flex: 1,
  },
  label: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.anchor,
    lineHeight: 22,
    color: colors.bone,
    letterSpacing: -0.3,
  },
  labelOn: {
    color: colors.leche,
  },
  // Tagline — at rest a whisper (the per-card taglineStyle drives the 0.85
  // resting opacity → 1 on selection). lineHeight + letterSpacing eased so
  // the descriptor breathes without dominating the label above it.
  tagline: {
    marginTop: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    lineHeight: 14,
    letterSpacing: 0.4,
    color: colors.niebla,
  },
  taglineOn: {
    color: '#F4ABC8',
  },
  /* Acknowledgment overlay — translucent veil so the atmosphere is
     intuited behind it. Bumped 0.82 → 0.84 for a touch more focus on the
     phrase. */
  celebOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    backgroundColor: 'rgba(10, 6, 8, 0.84)',
  },
  celebInner: {
    alignItems: 'center',
    gap: 22,
  },
  celebText: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.displaySm,
    lineHeight: 32,
    color: colors.leche,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
})
