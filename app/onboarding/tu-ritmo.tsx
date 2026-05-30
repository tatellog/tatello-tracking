import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
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
  Stepper,
  WarmBloomField,
  WizardLayout,
} from '@/features/onboarding/components'
import { type TrainingFrequency } from '@/features/profile/api'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)

const MIN_SLEEP = 3
const MAX_SLEEP = 14
const DEFAULT_SLEEP = 7

type TrainingOption = {
  value: TrainingFrequency
  label: string
  tagline: string
}

const TRAINING_OPTIONS: readonly TrainingOption[] = [
  {
    value: 'none',
    label: 'No me muevo todavía',
    tagline: 'Stelar lee tu base y te acompaña a entrar',
  },
  {
    value: 'low',
    label: '1 o 2 veces por semana',
    tagline: 'Movimiento ocasional, sin patrón fijo',
  },
  {
    value: 'mid',
    label: '3 o 4 veces por semana',
    tagline: 'Rutina sostenida con días libres',
  },
  {
    value: 'high',
    label: '5 o más veces por semana',
    tagline: 'Te mueves casi todos los días',
  },
]

/*
 * Step 9 — Tu ritmo. Asks for the user's typical sleep hours and
 * training frequency. The two baselines the Voz needs so sentences
 * like "cinco horas se notan" can land — without them Stelar can only
 * speak in averages.
 *
 * The previous version stacked two visually disconnected sections
 * (a Stepper for sleep, then a SelectableCard list for movement) with
 * different cards reading like a generic form. This version uses one
 * cohesive cosmic language: each section gets an eyebrow, the movement
 * options use the magenta-dot + slide-right card pattern, and a thin
 * gradient hairline separates the two so they read as "two pieces of one
 * baseline" rather than two forms stacked.
 *
 * ATMOSPHERE PARITY (illustrator pass — bring step 9 to the SAME line as
 * steps 1–7): this screen was a bare dark page while every step before it
 * paints a full-screen sky. We reuse the shared atmosphere primitives
 * (AtmosphericSky + WarmBloomField + a local RitmoSky) so it breathes with
 * the rest of the wizard — but DELIBERATELY COLDER and CALMER, and TINTED
 * INDIGO because the screen opens on "Sueño habitual":
 *   • NO NebulaWash PNG. Like tu-ciclo (step 8), the beat here is calm
 *     CONTAINMENT, not a painterly warm stage. The bare cool sky reads as
 *     resting-space — fitting for a screen about sleep + rhythm.
 *   • Glow pulled to cx42%/cy38% — distinct from step 8's 58%/38% so two
 *     consecutive screens don't share the same off-frame sun.
 *   • WarmBloomField variant="exposed-low-LEFT" — REUSED, not new. Step 8
 *     (ciclo) uses "exposed-low-right"; using "exposed-low-left" here avoids
 *     chaining two identical skies and gives step 9 its own composition
 *     (pure reuse, no new variant authored).
 *   • RitmoSky — a reduced, COLD clone of step 8's CicloSky, but tinted
 *     toward dimension.sueno (#7C8FFF indigo) instead of dimension.ciclo —
 *     the micro-stars + the low cool wisp carry the indigo of "sleep". The
 *     far/mid strata stay cool-neutral so the field reads quiet, not neon.
 *
 * Four clocks. dotClock (8 s, ping-pong) was here before and drives the
 * resting breath of every TrainingCard's dot — CONSERVED. Three atmosphere
 * clocks (5 s / 18 s / 40 s) were ADDED to match steps 1–8's compás. All
 * created ONCE on the screen (one compás, no duplicated shared values).
 */
export default function TuRitmoScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()

  const [sleep, setSleep] = useState<number>(profile?.typical_sleep_hours ?? DEFAULT_SLEEP)
  const [training, setTraining] = useState<TrainingFrequency | null>(
    (profile?.training_frequency as TrainingFrequency | null) ?? null,
  )

  // Personalised eyebrow was "Tu ritmo · {firstName}". That read as a
  // debug data-row when the name landed in caps next to the section
  // label. The screen already names itself; we drop the per-name
  // suffix for a clean eyebrow.
  const eyebrow = 'Tu ritmo'

  // dotClock — the slow 8 s ping-pong breath that drives the resting state
  // of every TrainingCard's dot (CONSERVED from the original screen, just
  // renamed from `clock` for clarity now that the atmosphere clocks exist).
  const dotClock = useSharedValue(0)

  // Atmosphere clocks — created ONCE here so every atmosphere layer
  // (WarmBloomField, star strata + dust + cool wisp) breathes on the SAME
  // values (no duplicated shared values, same periods as steps 1–8 → same
  // compás):
  //   clock  5 s  warm-field breath
  //   dust  18 s  cosmic-dust drift + cool-wisp breath
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

  const canContinue = training !== null

  const handlePickTraining = (next: TrainingFrequency) => {
    Haptics.selectionAsync().catch(() => {})
    setTraining(next)
  }

  const handleContinue = () => {
    if (!canContinue || !training) return
    updateProfile.mutate(
      {
        typical_sleep_hours: Number(sleep.toFixed(1)),
        training_frequency: training,
      },
      {
        onSuccess: () => router.push('/onboarding/tu-intencion'),
      },
    )
  }

  return (
    <WizardLayout
      step={9}
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
          {/* 1. Shared cool glow — pulled up-mid-left so the cold recedes
              (aerial perspective). cx42%/cy38% is distinct from step 8's
              58%/38% so two consecutive screens don't share the same
              off-frame sun. NO NebulaWash PNG: the rhythm/sleep theme calls
              for a calm, contained cool sky, not a painterly warm stage. */}
          <AtmosphericSky glow={{ cx: '42%', cy: '38%', r: '66%' }} />
          {/* 2. Deep warm atmosphere — REUSED 'exposed-low-left' (step 8
              uses 'exposed-low-right'; reuse here avoids chaining two
              identical skies and protects steps 4/5/6 — no new variant). */}
          <WarmBloomField clock={clock} variant="exposed-low-left" />
          {/* 3. Painted depth — INDIGO star strata + dimmed dust + a low cool
              wisp, full-screen, whisper-low, hidden from VoiceOver. Tinted
              toward dimension.sueno (#7C8FFF) for the "sleep" register. */}
          <RitmoSky dust={dust} orbit={orbit} />
        </>
      }
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StepHeader
          eyebrow={eyebrow}
          eyebrowColor="magenta"
          question={'¿Cómo descansas\ny te mueves?'}
          questionEmphasis="descansas"
          hint="Una foto rápida de tu base."
        />

        {/* Sleep section. */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Sueño habitual</Text>
          <Stepper
            label=""
            value={sleep}
            onChange={setSleep}
            min={MIN_SLEEP}
            max={MAX_SLEEP}
            step={0.5}
            unit="horas"
            decimals={1}
          />
          <Text style={styles.caveat}>Tu promedio, no el ideal.</Text>
        </View>

        {/* Thin gradient hairline that separates "cómo descansas"
            from "cómo te mueves" without making them feel like two
            different forms. */}
        <View style={styles.divider} />

        {/* Movement section. */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Movimiento por semana</Text>
          {/* Single-select group — the four cards form ONE logical
              radiogroup so VoiceOver announces the mutual exclusion. The
              TrainingCards are role="radio"; there is no opt-out here. */}
          <View
            style={styles.optionsBlock}
            accessibilityRole="radiogroup"
            accessibilityLabel="Movimiento por semana"
          >
            {TRAINING_OPTIONS.map((opt) => {
              const selected = training === opt.value
              const isAnySelected = training !== null
              return (
                <TrainingCard
                  key={opt.value}
                  option={opt}
                  selected={selected}
                  dim={isAnySelected && !selected}
                  onPress={() => handlePickTraining(opt.value)}
                  clock={dotClock}
                />
              )
            })}
          </View>
          {/* Twin of the sleep caveat — disarms the movement cards being
              read as a grade. Negates the "should" without naming a goal
              (voice-and-copy): no virtue hierarchy, "No me muevo todavía"
              is a position, not a lower score. */}
          <Text style={styles.caveat}>Dónde estás hoy, no dónde deberías.</Text>
        </View>
      </ScrollView>
    </WizardLayout>
  )
}

/* ─────────────────────── Card ─────────────────────── */

/** A training-frequency card. The idle treatment is ALWAYS the solid
 *  bgCard + warm hairline (legibility over the cosmic backdrop); selection
 *  is layered on top as a 200 ms OPACITY crossfade rather than a binary
 *  style swap — parity with tu-ciclo's CycleCard. Three absoluteFill layers
 *  fade IN on a per-card `glow` shared value:
 *    (a) shadow layer — static magenta iOS shadow, opacity-crossfaded;
 *    (b) magenta fill 0.12;
 *    (c) magenta 1 px border.
 *  All three share the EXACT borderRadius (16) of the idle card so no
 *  corner peeks out as they fade. The scale spring, the text slide and the
 *  dot breath (on dotClock) are unchanged. */
function TrainingCard({
  option,
  selected,
  dim,
  onPress,
  clock,
}: {
  option: TrainingOption
  selected: boolean
  dim: boolean
  onPress: () => void
  clock: SharedValue<number>
}) {
  // Scale spring (unchanged) — the existing tactile bounce on selection.
  const scale = useSharedValue(1)
  useEffect(() => {
    scale.value = withSpring(selected ? 1.02 : 1, { damping: 16, stiffness: 220 })
    return () => cancelAnimation(scale)
  }, [selected, scale])

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  // Glow crossfade — the selected card's magenta treatment fades IN/OUT on
  // OPACITY (200 ms / ease-out-quad, the twin compás of tu-ciclo's card
  // glow). We never animate shadowRadius/shadowOpacity or border/fill colors
  // numerically; dedicated layers carry the static look and only their
  // opacity tweens.
  const glow = useSharedValue(selected ? 1 : 0)
  useEffect(() => {
    glow.value = withTiming(selected ? 1 : 0, { duration: 200, easing: Easing.out(Easing.quad) })
    return () => cancelAnimation(glow)
  }, [selected, glow])
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }))

  const textStyle = useAnimatedStyle(() => {
    'worklet'
    return { transform: [{ translateX: selected ? 4 : 0 }] }
  })

  const dotStyle = useAnimatedStyle(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    const s = selected ? 1.25 : 1
    return {
      transform: [{ scale: s * (1 + b * 0.08) }],
      // dim 0.30 (was 0.18): the non-selected options must read as
      // "still available if I picked wrong", not "closed / discarded".
      // 0.18 fell too dark for an all-or-nothing profile (the magenta dot
      // looked switched off); 0.30 keeps a clear gap from the selected
      // dot (1.0) while leaving the alternatives plainly open.
      opacity: selected ? 1 : dim ? 0.3 : 0.42 + b * 0.12,
    }
  })

  return (
    <Animated.View style={[styles.cardOuter, cardStyle]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityLabel={option.label}
        accessibilityState={{ selected }}
        android_ripple={{ color: 'rgba(217, 39, 102, 0.18)', borderless: false }}
        style={({ pressed }) => [pressed && styles.cardPressed]}
      >
        {/* Idle card — ALWAYS solid bgCard + warm hairline so the label
            stays legible over the cosmic backdrop regardless of selection. */}
        <View style={styles.card}>
          {/* (a) Shadow layer — static magenta iOS shadow, crossfaded by
              opacity. Behind the content so the halo blooms under the card. */}
          <Animated.View style={[styles.cardGlowShadow, glowStyle]} pointerEvents="none" />
          {/* (b) Magenta fill — 0.12 tint, crossfaded in. */}
          <Animated.View style={[styles.cardGlowFill, glowStyle]} pointerEvents="none" />
          {/* (c) Magenta border — 1 px, crossfaded in over the hairline. */}
          <Animated.View style={[styles.cardGlowBorder, glowStyle]} pointerEvents="none" />

          <Animated.View style={[styles.dot, selected ? styles.dotOn : styles.dotOff, dotStyle]} />
          <Animated.View style={[styles.textCol, textStyle]}>
            <Text style={[styles.label, selected && styles.labelOn]}>{option.label}</Text>
            <Text style={[styles.tagline, selected && styles.taglineOn]}>{option.tagline}</Text>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  )
}

/* ───────────────────── Full-screen star sky ────────────────────── */

// Star strata — a COLD, THINNED clone of step 8's CicloSky, tinted toward
// dimension.sueno (indigo). x/y are 0→1 fractions of the screen; parallax
// amplitude grows toward the viewer (far 2px / mid 5px / micro 9px).
// Concentrated in the LOWER half so the depth pools under the cards, never
// behind their text. The band is held to y≥0.58 (same as step 8) so a
// xMidYMid slice on a tall viewport keeps stars clear of the card stack.
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

// Micro-stars — nearest field, INDIGO (dimension.sueno), halo + parallax.
const MICRO_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.24, y: 0.68, r: 1.1, opacity: 0.42 },
  { x: 0.8, y: 0.7, r: 1.0, opacity: 0.38 },
  { x: 0.5, y: 0.76, r: 0.9, opacity: 0.34 },
  { x: 0.14, y: 0.89, r: 1.0, opacity: 0.36 },
  { x: 0.88, y: 0.8, r: 0.85, opacity: 0.3 },
  { x: 0.58, y: 0.9, r: 0.8, opacity: 0.28 },
]

// DUST — thinned to 4 motes, opacities dimmed, rising through the lower
// half. They whisper behind the cards without competing.
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
 * RitmoSky — full-screen painted depth for step 9. A reduced, COLD clone of
 * step 8's CicloSky: three star strata + rising dust + a low cool wisp,
 * behind the content. The stars sit in the LOWER half (the cards own the
 * top, so the sky stays a whisper there). Differential parallax (2/5/9px)
 * on the 40 s orbit clock, dust + wisp on the 18 s clock. All whisper-low
 * alphas, pointerEvents none, hidden from VoiceOver.
 *
 * THEMATIC DIFFERENCE vs CicloSky — the screen opens on "Sueño habitual",
 * so the sky tints toward dimension.sueno (#7C8FFF indigo) instead of the
 * dimension.ciclo silver-blue: the micro-stars and the cool wisp carry the
 * indigo of sleep. The far/mid strata stay cool-neutral (slightly indigo
 * far) so the field reads quiet, not neon.
 *
 * COOL WISP — a wide-and-low indigo ellipse at cy ~0.66 that breathes
 * 0.04↔0.06 on the dust clock. It enriches the cold lower half with ambient
 * depth, NO free-floating focal star to celebrate any one answer.
 *
 * Parallax/twinkle move ONLY a numeric translate(px px) + opacity — never
 * an animated r/length as a string % (re-resolves against the viewport
 * every frame → jank). Gradient ids are namespaced `ritmo-*` so they cannot
 * collide with step 8's `ciclo-*` / step 3's `atrib-*` defs.
 */
function RitmoSky({ dust, orbit }: { dust: SharedValue<number>; orbit: SharedValue<number> }) {
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

  // ── Cool wisp breath ─────────────────────────────────────────────
  // A wide, low ellipse of indigo sleep-light at cy 0.66 (media-baja). It
  // breathes between 0.04 and 0.06 on the 18 s dust clock — opacity only
  // (numeric, UI-thread safe). Carries the cold lower half as ambient
  // depth (reuses the shared dust clock, no new shared value).
  const coolWispProps = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 + 0.5 * Math.sin(dust.value * 2 * Math.PI)
    return { opacity: 0.04 + w * 0.02 }
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
              flat drawn dots. Namespaced `ritmo-*` to avoid collisions. */}
          <RadialGradient id="ritmo-starGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          {/* Cool wisp — indigo sueno, faint, falls off to nothing. */}
          <RadialGradient id="ritmo-coolWisp" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.dimension.sueno} stopOpacity="0.06" />
            <Stop offset="1" stopColor={colors.dimension.sueno} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Cool wisp — wide-and-low ellipse at cy 0.66. Breathes faintly on
            the dust clock; depth without a free-floating focal point. */}
        <AnimatedEllipse
          cx={0.5 * SKY_W}
          cy={0.66 * SKY_H}
          rx={0.55 * SKY_W}
          ry={0.06 * SKY_H}
          fill="url(#ritmo-coolWisp)"
          animatedProps={coolWispProps}
        />

        {/* Cosmic dust rising through the lower half — indigo, dimmed. */}
        {DUST.map((d, i) => (
          <DustMote
            key={`sky-dust-${i}`}
            {...d}
            clock={dust}
            stage={SKY_H}
            fill={colors.dimension.sueno}
          />
        ))}

        {/* Far stars — distant stratum, faintly indigo, 2px parallax. */}
        <AnimatedG animatedProps={farDriftProps}>
          {FAR_STARS.map((s, i) => (
            <G key={`far-${i}`}>
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r * 2.4}
                fill="url(#ritmo-starGlow)"
                opacity={s.opacity * 0.6}
              />
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r}
                fill={colors.dimension.sueno}
                opacity={s.opacity}
              />
            </G>
          ))}
        </AnimatedG>

        {/* Mid stars — middle depth, cool-neutral tint, 5px drift. */}
        <AnimatedG animatedProps={midDriftProps}>
          {MID_STARS.map((s, i) => (
            <Circle
              key={`mid-${i}`}
              cx={s.x * SKY_W}
              cy={s.y * SKY_H}
              r={s.r}
              fill="#D6DAEC"
              opacity={s.opacity}
            />
          ))}
        </AnimatedG>

        {/* Micro stars — nearest field, INDIGO (sleep accent), halo + 9px
            parallax + group twinkle. Halo first so the point sits on a
            glow. */}
        <AnimatedG animatedProps={microGroupProps}>
          {MICRO_STARS.map((s, i) => (
            <G key={`micro-${i}`}>
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r * 2.5}
                fill="url(#ritmo-starGlow)"
                opacity={0.15}
              />
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r}
                fill={colors.dimension.sueno}
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    marginTop: 28,
    gap: 10,
  },
  sectionEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    color: colors.magenta,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginTop: 28,
  },
  // Padding horizontal so the selected card's magenta shadow
  // (radius 14) doesn't get clipped by the ScrollView's implicit
  // overflow:hidden. Same fix pattern as tu-ciclo + cuerpo-base.
  optionsBlock: {
    gap: 10,
    paddingHorizontal: 14,
  },
  caveat: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.label,
    lineHeight: 17,
    color: colors.niebla,
    marginTop: 4,
  },
  /* Training card — the idle treatment is ALWAYS the solid bgCard + warm
     hairline (legibility over the cosmic backdrop); selection is layered on
     top via the glow layers below, so this stays the single constant base
     regardless of state. The glow layers MUST match this borderRadius
     exactly (16) so no corner peeks. */
  cardOuter: {},
  cardPressed: {
    opacity: 0.88,
  },
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
  // per-card glow value. backgroundColor stays transparent (Android View
  // shadows don't blur → harmless transparent rect; iOS is the validation
  // platform). borderRadius matches `card` (16) so the halo blooms from the
  // same rounded silhouette.
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
  // (c) Magenta border — 1 px, crossfaded in over the warm hairline.
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
    fontSize: typography.sizes.title,
    lineHeight: 22,
    color: colors.bone,
    letterSpacing: -0.3,
  },
  labelOn: {
    color: colors.leche,
  },
  tagline: {
    marginTop: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    lineHeight: 15,
    letterSpacing: 0.3,
    color: colors.niebla,
  },
  taglineOn: {
    color: '#F4ABC8',
  },
})
