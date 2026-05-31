import { useRouter } from 'expo-router'
import { memo, useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Image as SvgImage,
  LinearGradient as SvgLinearGradient,
  Rect,
  RadialGradient,
  Stop,
} from 'react-native-svg'

import { useBriefContext } from '@/features/brief/hooks'
import {
  AtmosphericSky,
  DustMote,
  StepHeader,
  WarmBloomField,
  WizardLayout,
} from '@/features/onboarding/components'
import { useProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)
const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

// Painted galaxy used as whisper-low background texture — the same PNG that
// ships as the SEMANA orb, cloned LOCALLY from weight. Here it reads as
// abstract nebular texture, never as an object.
const NEBULA_ART = require('@/assets/orbits-art/orbit-week-art.png')

/*
 * Tu base (step 7) — the optional reflection step between weight and cycle.
 * Only surfaces when we have BOTH height and weight; otherwise auto-advances
 * silently (no point holding the user on a screen with nothing to compute).
 *
 * MANIFIESTO CARE — this is the MOST sensitive screen in the onboarding. The
 * weight/BMI must never DOMINATE, never JUDGE, never be CELEBRATED. behavioral
 * + illustrator + voice-and-copy converged on a hard reduction:
 *   · the range badge (a verdict on the body, brushing clinical territory) is
 *     GONE.
 *   · the BMI is DEMOTED from a 96px hero to a quiet third row of the formula
 *     ("Tu IMC"), same neutral style as peso/altura — no count-up, no halo.
 *   · the anchor star ("Tu base está lista") is GONE; the closing beat is a
 *     calm line, not a hero.
 * The number is present and honest, but it is just one row among three.
 *
 * COPY STRUCTURE (no echo) — the screen orients ONCE and reaffirms ONCE:
 *   · headline "Tu punto de partida" (StepHeader question) — says the purpose.
 *   · serif body — the manifiesto promise only ("Stelar lo guarda y no te lo
 *     va a nombrar todos los días"); the redundant "punto de salida" is GONE.
 *   · the IMC inline note — explains WHAT the number is and frames it as a
 *     calibration ("desde donde Stelar te calibra"), not a verdict. No
 *     classification (never "normal/sobrepeso").
 *   · closing "Listo. Stelar ya te lee." — calm.
 * The phrase "punto de partida/salida" must appear exactly ONCE (the headline).
 *
 * STRAIGHTENED-SISTER ATMOSPHERE — baseline wears the SAME contained grammar as
 * weight ("tercera hermana enderezada"): every pivot CENTRED, every rotation
 * 0°, but ~10% MORE tenue (it is the BMI screen). The golden rule: the central
 * vertical band — where the formula rows live — stays EMPTY of warm light. The
 * warm weight pools LOW; the COOL glow sits HIGH over the eyebrow, far from the
 * number. Back→front:
 *   1. BaseNebulaWash — painted galaxy, pivot floor-centre-low (cx50%/cy96%),
 *      rotation 0°, faded hard by 0.70, reduced breath. ids `base-*`.
 *   2. AtmosphericSky — cool glow CENTRED-HIGH over the header (50%/28%/58%).
 *   3. WarmBloomField variant="exposed-low-left" (reused) — warm pooled low.
 *   4. BaseSky — symmetric "U" strata + edge dust + a low cool wisp, all ~10%
 *      below weight's opacities. ids `base-*`.
 *
 * The base cosmic backdrop (starfield + Stelar presence) is mounted PER SCREEN
 * by WizardLayout (its own opaque <WizardBackdrop />) so the slide transition
 * fully occludes the screen behind it; the presence breath is shared via
 * WizardPresenceContext so it never restarts.
 *
 * Three clocks (5 s / 18 s / 40 s) are created ONCE in the screen and shared by
 * every atmosphere layer so there is one compás. No precision-mode dimmer here
 * (there is no wheel to spin).
 */
export default function BaseScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const { data: brief } = useBriefContext()
  const [auto, setAuto] = useState(false)
  const [showHow, setShowHow] = useState(false)

  const heightCm = profile?.height_cm ?? null
  const weightKg = brief?.latest_measurement?.weight_kg ?? null

  const bmi = useMemo(() => {
    if (heightCm == null || weightKg == null) return null
    const meters = heightCm / 100
    if (meters <= 0) return null
    return weightKg / (meters * meters)
  }, [heightCm, weightKg])

  useEffect(() => {
    if (bmi == null && !auto) {
      setAuto(true)
      router.replace('/onboarding/cycle')
    }
  }, [bmi, auto, router])

  // Shared clocks for the whole step — created ONCE here so every atmosphere
  // layer breathes on the SAME values, mirroring weight:
  //   clock  5 s  warm-field breath + nebula-texture breath
  //   dust  18 s  cosmic-dust drift + cool-wisp breath
  //   orbit 40 s  star-strata parallax
  const clock = useSharedValue(0)
  const dust = useSharedValue(0)
  const orbit = useSharedValue(0)

  useEffect(() => {
    clock.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false)
    dust.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.linear }), -1, false)
    orbit.value = withRepeat(withTiming(1, { duration: 40000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(clock)
      cancelAnimation(dust)
      cancelAnimation(orbit)
    }
  }, [clock, dust, orbit])

  if (bmi == null) {
    return <View style={styles.skipPad} />
  }

  return (
    <WizardLayout
      step={7}
      totalSteps={9}
      canContinue
      onContinue={() => router.push('/onboarding/cycle')}
      continueLabel="Continuar"
      ctaVariant="soft"
      ctaTransform="none"
      atmosphere={
        // Contained atmosphere — a11y-hidden + pointerEvents none so VoiceOver
        // never reads it. No precision dimmer (no wheel on this screen).
        <Animated.View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {/* 1. Painterly texture — straightened, centred low, faded hard. */}
          <BaseNebulaWash clock={clock} />
          {/* 2. Cool glow CENTRED-HIGH over the eyebrow (far from the number). */}
          <AtmosphericSky glow={{ cx: '50%', cy: '28%', r: '58%' }} />
          {/* 3. Warm weight pooled low + de-coaxialised (reused exposed). */}
          <WarmBloomField clock={clock} variant="exposed-low-left" />
          {/* 4. Symmetric "U" star strata + edge dust + a low cool wisp. */}
          <BaseSky dust={dust} orbit={orbit} />
        </Animated.View>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Purpose headline — says WHAT this screen is once ("punto de
            partida"); "partida" lifts into serif italic magenta. Replaces the
            old empty question="" that left a mute 36px gap. */}
        <StepHeader
          eyebrow="Tu base"
          eyebrowColor="magenta"
          question="Tu punto de partida"
          questionEmphasis="partida"
        />

        {/* Reaffirmation, not the orienting line anymore — the headline already
            named the purpose, so this beat drops the redundant "punto de
            salida" and keeps ONLY the manifiesto promise (serif italic, coach
            voice). */}
        <Text style={styles.body}>Stelar lo guarda y no te lo va a nombrar todos los días.</Text>

        <Pressable
          onPress={() => setShowHow(true)}
          hitSlop={{ top: 14, bottom: 14, left: 24, right: 24 }}
          accessibilityRole="button"
        >
          {/* Visual size unchanged (micro). hitSlop lifts the touch target to
              ≥44pt without growing the label. */}
          <Text style={styles.howLink} suppressHighlighting>
            Cómo se calcula esto
          </Text>
        </Pressable>

        <View style={styles.rule} />

        {/* Formula block — the three values Stelar holds, surfaced as a tiny
            "ingredients" list. The BMI ("Tu IMC") is the THIRD row, in the
            exact same neutral style as peso/altura — present and honest, but
            never dominant, never judged. No count-up, no halo. */}
        <View style={styles.formulaBlock}>
          <View style={styles.formulaRow}>
            <Text style={styles.formulaLabel}>Tu peso</Text>
            <Text style={styles.formulaSep}>·</Text>
            {/* Number counts up; unit "kg" stays static. */}
            <CountUpValue target={weightKg!} decimals={1} unit="kg" delay={0} />
          </View>
          <View style={styles.formulaRow}>
            <Text style={styles.formulaLabel}>Tu altura</Text>
            <Text style={styles.formulaSep}>·</Text>
            <CountUpValue target={heightCm!} decimals={0} unit="cm" delay={150} />
          </View>
          <View style={styles.formulaRow}>
            <Text style={styles.formulaLabel}>Tu IMC</Text>
            <Text style={styles.formulaSep}>·</Text>
            {/* IMC enters LAST — the calm close. No unit. */}
            <CountUpValue target={bmi} decimals={1} delay={300} />
          </View>
        </View>

        {/* Inline IMC explanation — the essential "what is it / where am I /
            from here we start" now lives ON the screen (niebla, small), not
            hidden behind the sheet tap. Frames the number as a starting point,
            never a classification. */}
        <Text style={styles.imcNote}>
          El IMC es una proporción entre tu peso y tu altura. Es dónde estás hoy, y desde aquí
          empezamos.
        </Text>

        {/* Closing beat — calm, no star. Reorients from the figure to the act
            of starting. Serif italic, centred, serene (NOT a hero). */}
        <Text style={styles.closing}>Listo. Stelar ya te lee.</Text>
      </ScrollView>

      <HowCalculatedSheet visible={showHow} onClose={() => setShowHow(false)} />
    </WizardLayout>
  )
}

/* ───────────────────── Contained count-up value ────────────────────── */

/*
 * CountUpValue — a CONTAINED count-up for the three formula numbers. The
 * number counts 0 → target with ease-out (decelerates and LANDS soft, never a
 * slot-machine), ~800ms, staggered per row (peso 0ms · altura 150ms · IMC
 * 300ms — the IMC closes the cascade).
 *
 * Contained, by mandate: NO scale-pulse, halo, glow, or landing flash. The
 * digits just count; the number keeps EXACTLY the static formulaValue style.
 * Only the number animates — the unit ("kg"/"cm") is a static sibling.
 *
 * Technique: Animated TextInput + useAnimatedProps that formats `{ text }` in a
 * worklet from a single shared value (UI-thread, no per-frame JS / setState).
 * tabular-nums fixes digit width → zero layout reflow while counting.
 *
 * Reduced motion: the shared value initialises AT the target and never
 * animates → the final value shows instantly.
 *
 * A11y: the TextInput is decorative (editable=false, pointerEvents none); an
 * accessibilityLabel carries the final value + unit so VoiceOver reads the
 * landed number (e.g. "70.0 kg"), never "0" nor the count.
 */
function CountUpValue({
  target,
  decimals,
  unit,
  delay,
}: {
  target: number
  decimals: 0 | 1
  unit?: string
  delay: number
}) {
  const reduceMotion = useReducedMotion()
  // Start AT target when reduced motion is on → no count, final value instantly.
  const progress = useSharedValue(reduceMotion ? target : 0)

  useEffect(() => {
    if (reduceMotion) {
      progress.value = target
      return
    }
    progress.value = withDelay(
      delay,
      withTiming(target, { duration: 800, easing: Easing.out(Easing.cubic) }),
    )
    return () => {
      cancelAnimation(progress)
    }
  }, [progress, target, delay, reduceMotion])

  // `text` is a private TextInput prop Reanimated drives natively for count-ups
  // (it is not in TextInputProps), so the worklet return is cast.
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    return { text: progress.value.toFixed(decimals) } as Partial<TextInputProps>
  })

  const finalLabel = `${target.toFixed(decimals)}${unit ? ` ${unit}` : ''}`

  return (
    <View style={styles.valueWrap} accessible accessibilityLabel={finalLabel}>
      <AnimatedTextInput
        style={styles.countUpValue}
        animatedProps={animatedProps}
        defaultValue={progress.value.toFixed(decimals)}
        editable={false}
        underlineColorAndroid="transparent"
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
      {unit ? <Text style={styles.formulaValue}> {unit}</Text> : null}
    </View>
  )
}

/* ───────────────────── Full-screen star sky ────────────────────── */

/*
 * BaseSky — the contained, straightened star depth. A clone of weight's
 * WeightSky: same "U" composition (ceiling y 0.06–0.20 + floor y 0.80–0.94
 * populated, central band left EMPTY for the formula rows), same three strata
 * + parallax on the orbit clock, dust on the dust clock — but every opacity is
 * ~10% BELOW weight's (this is the BMI screen) and the cool wisp sits at
 * cy 0.72.
 *
 * No connected points, no figure, no glyph — pure ambient depth that never
 * makes the number dominant. Gradient ids are namespaced `base-*` so they never
 * collide with weight's `weight-*` defs.
 */
const CEIL_FAR: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.12, y: 0.07, r: 0.6, opacity: 0.072 },
  { x: 0.88, y: 0.09, r: 0.7, opacity: 0.09 },
  { x: 0.5, y: 0.06, r: 0.5, opacity: 0.063 },
  { x: 0.3, y: 0.15, r: 0.6, opacity: 0.072 },
  { x: 0.7, y: 0.17, r: 0.5, opacity: 0.063 },
]
const CEIL_MID: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.18, y: 0.12, r: 0.8, opacity: 0.144 },
  { x: 0.82, y: 0.14, r: 0.7, opacity: 0.162 },
  { x: 0.6, y: 0.1, r: 0.7, opacity: 0.144 },
  { x: 0.4, y: 0.19, r: 0.7, opacity: 0.135 },
]
// Dense micro cluster CENTRED at x≈0.5 (straightened).
const CEIL_MICRO: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.5, y: 0.09, r: 1.0, opacity: 0.27 },
  { x: 0.42, y: 0.16, r: 0.9, opacity: 0.234 },
  { x: 0.58, y: 0.17, r: 0.85, opacity: 0.225 },
]

// FLOOR strata.
const FLOOR_FAR: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.1, y: 0.84, r: 0.6, opacity: 0.072 },
  { x: 0.9, y: 0.86, r: 0.7, opacity: 0.09 },
  { x: 0.34, y: 0.92, r: 0.5, opacity: 0.063 },
  { x: 0.66, y: 0.9, r: 0.6, opacity: 0.072 },
]
const FLOOR_MID: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.16, y: 0.88, r: 0.8, opacity: 0.144 },
  { x: 0.86, y: 0.82, r: 0.7, opacity: 0.162 },
  { x: 0.5, y: 0.94, r: 0.7, opacity: 0.144 },
]
const FLOOR_MICRO: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.5, y: 0.85, r: 1.0, opacity: 0.252 },
  { x: 0.42, y: 0.9, r: 0.9, opacity: 0.225 },
  { x: 0.58, y: 0.89, r: 0.85, opacity: 0.225 },
]

// Dust — 4 motes rising up the EDGES only (x 0.10 / 0.88), never the centre.
const DUST: {
  x: number
  baseR: number
  period: number
  sway: number
  opacity: number
  phase: number
}[] = [
  { x: 0.1, baseR: 0.9, period: 1.05, sway: 7, opacity: 0.25, phase: 0.1 },
  { x: 0.88, baseR: 0.8, period: 0.95, sway: 8, opacity: 0.225, phase: 0.5 },
  { x: 0.12, baseR: 0.65, period: 1.2, sway: 6, opacity: 0.198, phase: 0.7 },
  { x: 0.86, baseR: 0.7, period: 1.12, sway: 7, opacity: 0.207, phase: 0.3 },
]

const BaseSky = memo(function BaseSky({
  dust,
  orbit,
}: {
  dust: SharedValue<number>
  orbit: SharedValue<number>
}) {
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

  // Cool wisp breath — a wide, low ellipse of cool ciclo light at cy 0.72,
  // ~10% below weight's wisp. Opacity only (numeric, UI-thread safe).
  const coolWispProps = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 + 0.5 * Math.sin(dust.value * 2 * Math.PI)
    return { opacity: 0.027 + w * 0.0135 }
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
          <RadialGradient id="base-starGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          {/* Cool wisp — silver-blue ciclo, faint, falls off to nothing. */}
          <RadialGradient id="base-coolWisp" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.dimension.ciclo} stopOpacity="0.04" />
            <Stop offset="1" stopColor={colors.dimension.ciclo} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Cool wisp — wide-and-low ellipse at cy 0.72. */}
        <AnimatedEllipse
          cx={0.5 * SKY_W}
          cy={0.72 * SKY_H}
          rx={0.55 * SKY_W}
          ry={0.06 * SKY_H}
          fill="url(#base-coolWisp)"
          animatedProps={coolWispProps}
        />

        {/* Cosmic dust rising along the EDGES only. */}
        {DUST.map((d, i) => (
          <DustMote key={`sky-dust-${i}`} {...d} clock={dust} stage={SKY_H} fill="#F8DBCE" />
        ))}

        {/* ── CEILING strata ── populated y 0.06–0.20 ── */}
        <AnimatedG animatedProps={farDriftProps}>
          {CEIL_FAR.map((s, i) => (
            <G key={`cfar-${i}`}>
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r * 2.4}
                fill="url(#base-starGlow)"
                opacity={s.opacity * 0.6}
              />
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r}
                fill={colors.dimension.ciclo}
                opacity={s.opacity}
              />
            </G>
          ))}
        </AnimatedG>
        <AnimatedG animatedProps={midDriftProps}>
          {CEIL_MID.map((s, i) => (
            <Circle
              key={`cmid-${i}`}
              cx={s.x * SKY_W}
              cy={s.y * SKY_H}
              r={s.r}
              fill="#E8D9DD"
              opacity={s.opacity}
            />
          ))}
        </AnimatedG>
        <AnimatedG animatedProps={microGroupProps}>
          {CEIL_MICRO.map((s, i) => (
            <G key={`cmicro-${i}`}>
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r * 2.5}
                fill="url(#base-starGlow)"
                opacity={0.117}
              />
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r}
                fill="#FBD7E3"
                opacity={s.opacity}
              />
            </G>
          ))}
        </AnimatedG>

        {/* ── FLOOR strata ── populated y 0.80–0.94 ── */}
        <AnimatedG animatedProps={farDriftProps}>
          {FLOOR_FAR.map((s, i) => (
            <G key={`ffar-${i}`}>
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r * 2.4}
                fill="url(#base-starGlow)"
                opacity={s.opacity * 0.6}
              />
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r}
                fill={colors.dimension.ciclo}
                opacity={s.opacity}
              />
            </G>
          ))}
        </AnimatedG>
        <AnimatedG animatedProps={midDriftProps}>
          {FLOOR_MID.map((s, i) => (
            <Circle
              key={`fmid-${i}`}
              cx={s.x * SKY_W}
              cy={s.y * SKY_H}
              r={s.r}
              fill="#E8D9DD"
              opacity={s.opacity}
            />
          ))}
        </AnimatedG>
        <AnimatedG animatedProps={microGroupProps}>
          {FLOOR_MICRO.map((s, i) => (
            <G key={`fmicro-${i}`}>
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r * 2.5}
                fill="url(#base-starGlow)"
                opacity={0.117}
              />
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r}
                fill="#FBD7E3"
                opacity={s.opacity}
              />
            </G>
          ))}
        </AnimatedG>
      </Svg>
    </View>
  )
})

/* ─────────────────────── Painted galaxy texture ─────────────────────── */

/*
 * BaseNebulaWash — the painterly base layer, cloned LOCALLY from weight and
 * straightened for this screen. Pivoted floor-centre-low (cx 50% / cy 96%),
 * rotated 0°, faded hard to black by offset 0.70 (the central band stays clear)
 * and dropped to whisper opacity ~10% below weight: 0.05 ↔ ~0.075. Transform /
 * size / position are STATIC. Gradient id is `base-*`.
 */
const BaseNebulaWash = memo(function BaseNebulaWash({ clock }: { clock: SharedValue<number> }) {
  const SKY_W = 360
  const SKY_H = 760

  const IMG_W = SKY_W * 1.5
  const IMG_H = IMG_W // square source art
  // Pivot floor-centre-low: (50% w, 96% h) — straightened, centred.
  const PIVOT_X = SKY_W * 0.5
  const PIVOT_Y = SKY_H * 0.96
  const IMG_X = PIVOT_X - IMG_W / 2
  const IMG_Y = PIVOT_Y - IMG_H / 2

  const imgProps = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    return { opacity: 0.05 + w * 0.025 }
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
          {/* Vertical fade — bg opaque at the top → transparent by 0.70 so the
              PNG melts well before the central formula channel. */}
          <SvgLinearGradient id="base-nebulaFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.bg} stopOpacity="1" />
            <Stop offset="0.7" stopColor={colors.bg} stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>

        {/* Painted galaxy — rotation 0° (straightened), centred low, breathing. */}
        <AnimatedG animatedProps={imgProps}>
          <G transform={`rotate(0 ${PIVOT_X} ${PIVOT_Y})`}>
            <SvgImage
              href={NEBULA_ART}
              x={IMG_X}
              y={IMG_Y}
              width={IMG_W}
              height={IMG_H}
              preserveAspectRatio="xMidYMid slice"
            />
          </G>
        </AnimatedG>

        {/* Fade the PNG's top edge into bg (no seam under the formula rows). */}
        <Rect x={0} y={0} width={SKY_W} height={SKY_H} fill="url(#base-nebulaFade)" />
      </Svg>
    </View>
  )
})

/* The "cómo se calcula" sheet — opens on the link tap below the body. Now holds
 * the DETAIL of the formula (the essential "what is it / not a grade" lives
 * inline on the screen). Names the formula, reinforces orientation-not-verdict,
 * and points at where the user can change inputs later. */
function HowCalculatedSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={sheetStyles.backdrop}>
        <Pressable style={sheetStyles.scrim} onPress={onClose} />
        <View style={[sheetStyles.sheet, { paddingBottom: insets.bottom }]}>
          <View style={sheetStyles.grabber} />
          <ScrollView
            contentContainerStyle={sheetStyles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={sheetStyles.eyebrow}>Cómo se calcula</Text>
            <Text style={sheetStyles.title}>
              El IMC es <Text style={sheetStyles.titleEm}>tu punto de partida</Text> — el lugar
              desde donde empezamos.
            </Text>

            <Text style={sheetStyles.section}>FÓRMULA</Text>
            <Text style={sheetStyles.body}>
              El IMC es tu peso (kg) dividido por tu altura al cuadrado (m²). Es una proporción, no
              mide grasa ni músculo. Una persona muy musculosa puede tener un IMC &quot;alto&quot;
              sin tener grasa extra.
            </Text>

            <Text style={sheetStyles.section}>QUÉ STELAR HACE CON ESTE NÚMERO</Text>
            <Text style={sheetStyles.body}>
              Lo guarda como uno más entre tus datos de base. Si más adelante registras peso de
              nuevo, podemos mostrarte cómo va cambiando. No te lo trae todos los días: no es lo que
              define tu progreso.
            </Text>

            <Text style={sheetStyles.section}>DÓNDE LO CAMBIO</Text>
            <Text style={sheetStyles.body}>
              Altura: Ajustes → Mi perfil. Peso: cuando lo registres de nuevo en Progreso (track
              corporal).
            </Text>
          </ScrollView>
          <Pressable style={sheetStyles.closeBtn} onPress={onClose}>
            <Text style={sheetStyles.closeBtnLabel}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  skipPad: {
    flex: 1,
    // OPAQUE colors.bg — this transient early-return placeholder (shown for a
    // frame before the auto-replace to cycle) keeps the same opaque grammar
    // as every other onboarding screen, so the slide always occludes cleanly.
    backgroundColor: colors.bg,
  },
  body: {
    marginTop: 22,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.ui,
    lineHeight: 22,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  howLink: {
    marginTop: 14,
    alignSelf: 'center',
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    color: colors.magenta,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    paddingVertical: 6,
    textDecorationLine: 'underline',
  },
  rule: {
    marginTop: 18,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  /* Formula block — 3 rows showing the values Stelar holds (peso · altura ·
     IMC). Reads as a tiny "ingredients" list; the IMC is the third row, in the
     exact same neutral style as the other two — no row dominates. */
  formulaBlock: {
    marginTop: 16,
    alignSelf: 'center',
    gap: 6,
  },
  formulaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  formulaLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
    minWidth: 70,
  },
  formulaSep: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.magenta,
  },
  formulaValue: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.ui,
    color: colors.bone,
    letterSpacing: -0.2,
  },
  /* Count-up value wrapper — the animated number + static unit sit on one
     baseline-aligned row, replacing the old single <Text> value. */
  valueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  /* Animated number — IDENTICAL to formulaValue (same serif italic / size /
     color / letterSpacing) so the count-up is visually indistinguishable from
     the static rows. tabular-nums freezes digit width → no reflow while
     counting. TextInput's default padding/min-height is zeroed so it lines up
     with the surrounding <Text>. */
  countUpValue: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.ui,
    color: colors.bone,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
    padding: 0,
    margin: 0,
  },
  /* Inline IMC explanation — small/niebla, lives below the formula rows (NOT in
     the sheet). Explains what the number is and frames it as calibration, never
     a classification. */
  imcNote: {
    marginTop: 14,
    alignSelf: 'center',
    maxWidth: 300,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    lineHeight: 18,
    color: colors.niebla,
    textAlign: 'center',
  },
  /* Closing beat — calm, no star, serif italic. Reorients from the figure to
     the act of starting. Magenta tenue, centred, serene (NOT a hero). */
  closing: {
    marginTop: 28,
    marginBottom: 16,
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.magenta,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
})

const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.bruma,
    maxHeight: '80%',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bruma,
    marginTop: 10,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 18,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    color: colors.magenta,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 8,
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.displaySm,
    lineHeight: 30,
    color: colors.leche,
    letterSpacing: -0.6,
  },
  titleEm: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    color: colors.magenta,
  },
  section: {
    marginTop: 22,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    color: colors.niebla,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  body: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.bone,
  },
  closeBtn: {
    marginHorizontal: 22,
    marginBottom: 8,
    backgroundColor: colors.magenta,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    letterSpacing: 0.3,
  },
})
