import { useRouter } from 'expo-router'
import { memo, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
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

import {
  AtmosphericSky,
  DustMote,
  StepHeader,
  WarmBloomField,
  WheelPicker,
  WizardLayout,
} from '@/features/onboarding/components'
import { useInsertInitialWeight } from '@/features/profile/hooks'
import { saveSkipWeight } from '@/lib/onboardingFlags'
import { colors, typography } from '@/theme'

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)
const AnimatedG = Animated.createAnimatedComponent(G)

const MIN_KG = 30
const MAX_KG = 200
const DEFAULT_KG = 70

// Painted galaxy used as whisper-low background texture — the same PNG that
// ships as the SEMANA orb, cloned LOCALLY from body-base/about-you. Here it
// reads as abstract nebular texture, never as an object.
const NEBULA_ART = require('@/assets/orbits-art/orbit-week-art.png')

/** Round to 1 decimal — avoids floating-point drift when composing
 *  integer + decimal/10. */
const round1 = (n: number) => Math.round(n * 10) / 10

/*
 * Weight — the body composition baseline (step 6), and the THIRD sister of
 * the calibration triptych (body-base → weight → baseline). Optional via
 * the "aún no tengo báscula" skip; otherwise, the dual wheel picker collects
 * the decimal value (Mifflin-St Jeor needs precision; a stepper would mean
 * hundreds of taps for the range).
 *
 * The value lands in body_measurements (time series), not profiles, so the
 * first reading anchors the historical graph from day 1.
 *
 * STRAIGHTENED-SISTER ATMOSPHERE (illustrator pass) — weight wears the SAME
 * visual grammar as its twins about-you (leans left, +22°) and body-base
 * (leans right, -22°), but ENDEREZADA: every pivot is CENTRED and every
 * rotation is 0°. After the sky "rotated" corner-to-corner across steps 4→5,
 * it comes to rest, centred and calm, on the weight screen.
 *
 * MANIFIESTO CARE — this is the PESO screen, so the atmosphere is deliberately
 * ~15–25% MORE tenue than its sisters and is composed so the NUMBER is never
 * made dominant or celebrated. The warm weight is pulled LOW and never climbs
 * to the wheel; the COOL glow is the one that touches the number's zone (calm,
 * not reward). The digits themselves stay perfectly still — nothing scales,
 * ignites, or brightens in response to the chosen value. Back→front:
 *   1. WeightNebulaWash — the painted galaxy, pivoted PISO-CENTRO-BAJO
 *      (cx50%/cy96%), rotation 0° (the straightened version), faded hard to
 *      black by offset 0.70 (more aggressive — the wheel lives high). Reduced
 *      breath opacity.
 *   2. AtmosphericSky — the cool glow CENTRED-HIGH over the header
 *      (50%/30%/60%), far from the number.
 *   3. WarmBloomField variant="exposed" — warm pooled low + de-coaxialised
 *      (reused attribution variant; NOT touched).
 *   4. WeightSky — symmetric "U" strata (micro cluster centred at x≈0.5, both
 *      ceiling and floor), edge dust, and a LOW cool wisp (cy0.70), all
 *      reduced in opacity.
 *
 * PRECISION MODE — the whole atmosphere DIMS (opacity → 0.4) while the user
 * SPINS either wheel, on the same 200 ms / ease-out-quad compás as the twins.
 *
 * The three clocks (5 s / 18 s / 40 s) are created ONCE here and shared by
 * every atmosphere layer so there is one compás.
 */
export default function WeightScreen() {
  const router = useRouter()
  const insertWeight = useInsertInitialWeight()
  const [value, setValue] = useState<number>(DEFAULT_KG)
  const [skip, setSkip] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingError, setSavingError] = useState<string | null>(null)

  // Precision mode — true only while a wheel is being spun.
  const [dragging, setDragging] = useState(false)

  // Decomposed into integer + decimal/10 so the picker can show
  // two side-by-side wheels (kilos + tenths) instead of one 1700-row
  // monster. Recomposed back into a single value for persistence.
  const integerPart = Math.floor(value)
  const decimalPart = Math.round((value - integerPart) * 10)

  const handleIntegerChange = (next: number) => {
    setValue(round1(next + decimalPart / 10))
  }
  const handleDecimalChange = (next: number) => {
    setValue(round1(integerPart + next / 10))
  }

  const canContinue = skip || (value >= MIN_KG && value <= MAX_KG + 0.9)

  // Shared clocks for the whole step — created ONCE here so every
  // atmosphere layer breathes on the SAME values, mirroring the twins:
  //   clock  5 s  warm-field breath + nebula-texture breath
  //   dust  18 s  cosmic-dust drift + cool-wisp breath
  //   orbit 40 s  star-strata parallax
  const clock = useSharedValue(0)
  const dust = useSharedValue(0)
  const orbit = useSharedValue(0)

  // Precision-mode atmosphere dimmer — 1 = full sky, 0.4 = calm (spinning).
  const atmoDim = useSharedValue(1)

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

  useEffect(() => {
    atmoDim.value = withTiming(dragging ? 0.4 : 1, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    })
    // Defensive cleanup — withTiming is one-shot, but cancel on unmount so a
    // teardown mid-tween never leaves a dangling animation.
    return () => cancelAnimation(atmoDim)
  }, [dragging, atmoDim])

  const atmoDimStyle = useAnimatedStyle(() => ({ opacity: atmoDim.value }))

  const handleContinue = async () => {
    if (!canContinue) return
    setSavingError(null)
    setSaving(true)
    try {
      if (skip) {
        await saveSkipWeight(true)
      } else {
        await saveSkipWeight(false)
        await insertWeight.mutateAsync(Number(value.toFixed(1)))
      }
      router.push('/onboarding/baseline')
    } catch (e) {
      setSavingError(e instanceof Error ? e.message : 'No pudimos guardar tu peso.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WizardLayout
      step={6}
      totalSteps={9}
      canContinue={canContinue}
      loading={saving}
      errorMessage={savingError ?? insertWeight.error?.message ?? null}
      onContinue={handleContinue}
      continueLabel="Continuar"
      ctaVariant="soft"
      ctaTransform="none"
      atmosphere={
        // Precision-mode wrapper — the ONE Animated.View whose opacity dims
        // the whole sky while a wheel is spun. a11y-hidden + pointerEvents
        // none so VoiceOver never reads it between the inputs.
        <Animated.View
          style={[StyleSheet.absoluteFill, atmoDimStyle]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {/* 1. Painterly texture — straightened, centred low, faded hard. */}
          <WeightNebulaWash clock={clock} />
          {/* 2. Cool glow CENTRED-HIGH over the header (far from the number). */}
          <AtmosphericSky glow={{ cx: '50%', cy: '30%', r: '60%' }} />
          {/* 3. Warm weight pooled low + de-coaxialised (reused exposed). */}
          <WarmBloomField clock={clock} variant="exposed" />
          {/* 4. Symmetric "U" star strata + edge dust + a low cool wisp. */}
          <WeightSky dust={dust} orbit={orbit} />
        </Animated.View>
      }
    >
      <StepHeader
        eyebrow="El punto de partida"
        eyebrowColor="magenta"
        question="Hoy pesas…"
        questionEmphasis="pesas"
        hint="De dónde empezamos."
      />

      <View style={styles.body}>
        {skip ? (
          <View style={styles.skipState}>
            <Text style={styles.skipNumber}>—</Text>
            <Text style={styles.skipUnit}>kg</Text>
          </View>
        ) : (
          <View style={styles.wheelsRow}>
            <View style={styles.kgWheel}>
              <WheelPicker
                min={MIN_KG}
                max={MAX_KG}
                step={1}
                value={integerPart}
                onChange={handleIntegerChange}
                decimals={0}
                onDragChange={setDragging}
                valueGlow="soft"
              />
            </View>
            <Text style={styles.separator}>.</Text>
            <View style={styles.decimalWheel}>
              <WheelPicker
                min={0}
                max={9}
                step={1}
                value={decimalPart}
                onChange={handleDecimalChange}
                decimals={0}
                onDragChange={setDragging}
                valueGlow="soft"
              />
            </View>
            <Text style={styles.unitLabel}>kg</Text>
          </View>
        )}

        <Text style={styles.caveat}>Es solo el punto de partida.{'\n'}No es tu valor.</Text>

        <Text style={styles.skipLink} onPress={() => setSkip((prev) => !prev)} suppressHighlighting>
          {skip ? 'Sí tengo báscula' : 'Aún no tengo báscula'}
        </Text>
      </View>
    </WizardLayout>
  )
}

/* ───────────────────── Full-screen star sky ────────────────────── */

/*
 * WeightSky — full-screen painted depth, the STRAIGHTENED SISTER of
 * body-base's BodySky. Same "U" composition (ceiling y 0.06–0.20 + floor
 * y 0.80–0.94 populated, central band left EMPTY), same three strata +
 * parallax on the orbit clock, dust on the dust clock — but ENDEREZADA: the
 * dense micro cluster sits CENTRED at x≈0.5 (about-you leans left, body-base
 * leans right; weight rests centred), and the cool wisp is REDUCED in opacity
 * and pushed slightly LOWER (cy 0.70).
 *
 * MANIFIESTO CARE — opacities here are ~15–20% lower than the twins (it is the
 * peso screen). No connected points, no figure, no glyph, no bloom-on-valid —
 * pure ambient depth that never makes the number dominant.
 *
 * Gradient ids are namespaced `weight-*` so they never collide with the twins'
 * `cuerpo-*` / `aboutyou-*` defs.
 */
const CEIL_FAR: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.12, y: 0.07, r: 0.6, opacity: 0.08 },
  { x: 0.88, y: 0.09, r: 0.7, opacity: 0.1 },
  { x: 0.5, y: 0.06, r: 0.5, opacity: 0.07 },
  { x: 0.3, y: 0.15, r: 0.6, opacity: 0.08 },
  { x: 0.7, y: 0.17, r: 0.5, opacity: 0.07 },
]
const CEIL_MID: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.18, y: 0.12, r: 0.8, opacity: 0.16 },
  { x: 0.82, y: 0.14, r: 0.7, opacity: 0.18 },
  { x: 0.6, y: 0.1, r: 0.7, opacity: 0.16 },
  { x: 0.4, y: 0.19, r: 0.7, opacity: 0.15 },
]
// Dense micro cluster CENTRED at x≈0.5 (straightened — neither lean-left nor
// lean-right).
const CEIL_MICRO: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.5, y: 0.09, r: 1.0, opacity: 0.3 },
  { x: 0.42, y: 0.16, r: 0.9, opacity: 0.26 },
  { x: 0.58, y: 0.17, r: 0.85, opacity: 0.25 },
]

// FLOOR strata.
const FLOOR_FAR: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.1, y: 0.84, r: 0.6, opacity: 0.08 },
  { x: 0.9, y: 0.86, r: 0.7, opacity: 0.1 },
  { x: 0.34, y: 0.92, r: 0.5, opacity: 0.07 },
  { x: 0.66, y: 0.9, r: 0.6, opacity: 0.08 },
]
const FLOOR_MID: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.16, y: 0.88, r: 0.8, opacity: 0.16 },
  { x: 0.86, y: 0.82, r: 0.7, opacity: 0.18 },
  { x: 0.5, y: 0.94, r: 0.7, opacity: 0.16 },
]
// Floor micro cluster CENTRED too, mirroring the ceiling's straightening.
const FLOOR_MICRO: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.5, y: 0.85, r: 1.0, opacity: 0.28 },
  { x: 0.42, y: 0.9, r: 0.9, opacity: 0.25 },
  { x: 0.58, y: 0.89, r: 0.85, opacity: 0.25 },
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
  { x: 0.1, baseR: 0.9, period: 1.05, sway: 7, opacity: 0.28, phase: 0.1 },
  { x: 0.88, baseR: 0.8, period: 0.95, sway: 8, opacity: 0.25, phase: 0.5 },
  { x: 0.12, baseR: 0.65, period: 1.2, sway: 6, opacity: 0.22, phase: 0.7 },
  { x: 0.86, baseR: 0.7, period: 1.12, sway: 7, opacity: 0.23, phase: 0.3 },
]

const WeightSky = memo(function WeightSky({
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

  // ── Cool wisp breath ─────────────────────────────────────────────
  // A wide, low ellipse of cool ciclo light pushed LOWER (cy 0.70) and
  // REDUCED in opacity (0.03 + w*0.015) vs. the twins — manifiesto care:
  // the lower half breathes but never pulls focus to the number. Opacity
  // only (numeric, UI-thread safe).
  const coolWispProps = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 + 0.5 * Math.sin(dust.value * 2 * Math.PI)
    return { opacity: 0.03 + w * 0.015 }
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
          <RadialGradient id="weight-starGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          {/* Cool wisp — silver-blue ciclo, faint, falls off to nothing. */}
          <RadialGradient id="weight-coolWisp" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.dimension.ciclo} stopOpacity="0.045" />
            <Stop offset="1" stopColor={colors.dimension.ciclo} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Cool wisp — wide-and-low ellipse pushed lower (cy 0.70). */}
        <AnimatedEllipse
          cx={0.5 * SKY_W}
          cy={0.7 * SKY_H}
          rx={0.55 * SKY_W}
          ry={0.06 * SKY_H}
          fill="url(#weight-coolWisp)"
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
                fill="url(#weight-starGlow)"
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
                fill="url(#weight-starGlow)"
                opacity={0.13}
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
                fill="url(#weight-starGlow)"
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
                fill="url(#weight-starGlow)"
                opacity={0.13}
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
 * WeightNebulaWash — the painterly base layer, cloned LOCALLY from body-base
 * and STRAIGHTENED for this screen. The same painted galaxy PNG blown up so it
 * bleeds past every edge and reads as nebular TEXTURE. Pivoted PISO-CENTRO-BAJO
 * (cx 50% / cy 96%) and rotated 0° (the straightened version — neither
 * about-you's +22° nor body-base's -22°), then dropped to whisper opacity.
 *
 * The vertical fade is MORE aggressive than the twins (to transparent by
 * offset 0.70 instead of 0.62) because the wheel lives HIGH on this screen —
 * nothing painterly may climb under the number.
 *
 * Only the PNG OPACITY breathes, REDUCED to 0.06 ↔ ~0.085 (vs. the twins'
 * 0.08 ↔ 0.11) — manifiesto care for the peso screen. Transform / size /
 * position are STATIC. Gradient id is `weight-*`.
 */
const WeightNebulaWash = memo(function WeightNebulaWash({ clock }: { clock: SharedValue<number> }) {
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
    return { opacity: 0.06 + w * 0.025 }
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
          {/* Vertical fade — bg opaque at the top → transparent by 0.70 so
              the PNG melts well before the high wheel channel. */}
          <SvgLinearGradient id="weight-nebulaFade" x1="0" y1="0" x2="0" y2="1">
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

        {/* Fade the PNG's top edge into bg (no seam under the wheel). */}
        <Rect x={0} y={0} width={SKY_W} height={SKY_H} fill="url(#weight-nebulaFade)" />
      </Svg>
    </View>
  )
})

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: 18,
    alignItems: 'center',
  },
  /* Dual-wheel row — kilos | "." | tenths | kg. Each wheel has an
     explicit width; the wrapper centers them with the separator and
     unit. The wheels' internal centre-band magenta hairlines align
     horizontally because both wheels share the same ITEM_HEIGHT /
     VISIBLE_COUNT contract from WheelPicker. */
  wheelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  kgWheel: {
    width: 120,
  },
  decimalWheel: {
    width: 64,
  },
  // Sits between the two wheels at the central row's y-position. Uses
  // the same heavy display font + cream halo as the active wheel
  // values so the trio reads as one number (69.8) at a glance.
  separator: {
    fontFamily: typography.displayHeavy,
    fontSize: 40,
    color: colors.leche,
    letterSpacing: -1,
    includeFontPadding: false,
    marginHorizontal: 2,
    textShadowColor: 'rgba(252, 246, 235, 0.22)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  unitLabel: {
    marginLeft: 10,
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.heading,
    color: colors.magenta,
    letterSpacing: -0.3,
  },
  skipState: {
    height: 56 * 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  skipNumber: {
    fontFamily: typography.displayHeavy,
    fontSize: 92,
    color: colors.niebla,
    letterSpacing: -3,
    includeFontPadding: false,
  },
  skipUnit: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    color: colors.magenta,
  },
  caveat: {
    marginTop: 18,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14.5,
    color: colors.bone,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 260,
  },
  // The dignified opt-out / toggle. Sentence-case (NOT uppercase) with a
  // soft letterSpacing (0.3) — on a deliberately gentle screen, the exit
  // should be the KINDEST element, not the most shouted. Magenta is kept
  // (it is the toggle's affordance) along with the size + the paddingVertical
  // tap target. The two strings ("Aún no tengo báscula" / "Sí tengo báscula")
  // both read calm in sentence-case.
  skipLink: {
    marginTop: 14,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    color: colors.magenta,
    letterSpacing: 0.3,
    textAlign: 'center',
    paddingVertical: 8,
  },
})
