import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
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
  HeightSlider,
  StepHeader,
  WarmBloomField,
  WizardLayout,
} from '@/features/onboarding/components'
import { type BiologicalSex } from '@/features/profile/api'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)
const AnimatedG = Animated.createAnimatedComponent(G)

const HEIGHT_MIN = 140
const HEIGHT_MAX = 200
const HEIGHT_DEFAULT = 170

// Painted galaxy used as a whisper-low background texture — the same PNG
// that ships as the SEMANA orb. Here it bleeds past the edges as abstract
// nebular texture, never read as an object. Cloned LOCALLY from about-you's
// NebulaWash and re-pivoted to the lower-RIGHT (the mirror of about-you's
// lower-left) so the two screens read as mirrored twins.
const NEBULA_ART = require('@/assets/orbits-art/orbit-week-art.png')

/*
 * Cuerpo — Screen 2 of the split "Cuéntame de ti" pair, and the MIRRORED
 * TWIN of about-you (step 4). Asks the height + biological sex Stelar
 * needs to calibrate energy estimates. Lives at /onboarding/cuerpo-base,
 * between about-you and weight.
 *
 * MIRRORED-TWIN ATMOSPHERE (illustrator pass) — cuerpo-base shares
 * about-you's EXACT visual grammar (same sky strata, same clock compás,
 * same clear central channel, same precision-dim), but MIRRORED on the
 * horizontal axis: about-you loads its weight to the LEFT, cuerpo-base
 * spells it to the RIGHT. Advancing from step 4 → 5 reads as the sky
 * "rotating" corner-to-corner. Back→front:
 *   1. NebulaWash  — the painted galaxy PNG, re-pivoted to the lower-RIGHT
 *                    (cx82%/cy92%), rotated -22° (mirror of about-you's
 *                    +22°), faded hard to black by offset 0.62 so nothing
 *                    crosses under the slider.
 *   2. AtmosphericSky — the cool glow pulled HIGH up-RIGHT (76%/34%/58%,
 *                    the mirror of about-you's 24%/34%) so the cold sits
 *                    over the header.
 *   3. WarmBloomField variant="exposed-low-right": warm weight in the
 *                    lower-RIGHT corner only (the mirror variant).
 *   4. CuerpoSky   — star strata in a "U" (ceiling + floor populated, the
 *                    central band 0.30–0.72 left empty), dust along the
 *                    edges, plus a wide-and-low COOL WISP in the media-baja
 *                    zone — pure ambient depth that fills the lower half.
 *
 * PRECISION MODE — the whole atmosphere DIMS (opacity → 0.4) while the user
 * DRAGS the height slider (on the same 200 ms / ease-out-quad compás as
 * about-you's typing dim). The sex pills are instant taps, so they do NOT
 * dim — only the continuous slider drag calms the sky.
 *
 * The three clocks (5 s / 18 s / 40 s) are created ONCE on the screen and
 * shared by every atmosphere layer so there is one compás.
 */
export default function CuerpoBaseScreen() {
  const router = useRouter()
  const { source } = useLocalSearchParams<{ source?: string }>()
  const fromSettings = source === 'settings'
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()

  const [height, setHeight] = useState<number>(
    profile?.height_cm && profile.height_cm >= HEIGHT_MIN && profile.height_cm <= HEIGHT_MAX
      ? profile.height_cm
      : HEIGHT_DEFAULT,
  )
  const [sex, setSex] = useState<BiologicalSex | null>(
    (profile?.biological_sex as BiologicalSex | null) ?? null,
  )

  const heightValid = height >= HEIGHT_MIN && height <= HEIGHT_MAX
  const sexValid = sex !== null
  const canContinue = heightValid && sexValid

  // Precision mode — true only while the slider is being dragged. The pills
  // are instant taps and never set this.
  const [dragging, setDragging] = useState(false)

  // Shared clocks for the whole step — created ONCE here so every
  // atmosphere layer (NebulaWash, WarmBloomField, star strata + dust)
  // breathes on the SAME values, mirroring about-you's periods:
  //   clock  5 s  warm-field breath + nebula-texture breath
  //   dust  18 s  cosmic-dust drift + cool-wisp breath
  //   orbit 40 s  star-strata parallax
  const clock = useSharedValue(0)
  const dust = useSharedValue(0)
  const orbit = useSharedValue(0)

  // Precision-mode atmosphere dimmer — 1 = full sky, 0.4 = calm (dragging).
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

  const handleContinue = () => {
    if (!canContinue || !sex) return
    updateProfile.mutate(
      {
        biological_sex: sex,
        height_cm: Math.round(height),
      },
      {
        onSuccess: () => (fromSettings ? router.back() : router.push('/onboarding/weight')),
      },
    )
  }

  return (
    <WizardLayout
      step={5}
      totalSteps={9}
      canContinue={canContinue}
      loading={updateProfile.isPending}
      errorMessage={updateProfile.error?.message}
      onContinue={handleContinue}
      continueLabel="Continuar"
      ctaVariant="soft"
      ctaTransform="none"
      atmosphere={
        // Precision-mode wrapper — the ONE Animated.View whose opacity dims
        // the whole sky while the slider is dragged. a11y-hidden +
        // pointerEvents none so VoiceOver never reads it between the inputs.
        <Animated.View
          style={[StyleSheet.absoluteFill, atmoDimStyle]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {/* 1. Painterly texture — the painted galaxy, re-pivoted to the
              lower-RIGHT (mirror of about-you), faded hard. */}
          <NebulaWash clock={clock} />
          {/* 2. Cool glow pulled HIGH up-right (mirror of about-you's 24%). */}
          <AtmosphericSky glow={{ cx: '76%', cy: '34%', r: '58%' }} />
          {/* 3. Warm weight in the lower-RIGHT corner only (mirror variant). */}
          <WarmBloomField clock={clock} variant="exposed-low-right" />
          {/* 4. Star strata in a "U" + edge dust + a low cool wisp. */}
          <CuerpoSky dust={dust} orbit={orbit} />
        </Animated.View>
      }
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <StepHeader
          eyebrow="El cuerpo que te lee"
          eyebrowColor="magenta"
          question="Tu cuerpo base."
          questionEmphasis="Tu cuerpo"
          hint="Stelar lo usa para calibrar lo que registras."
        />

        <Section question="¿cuánto mides?">
          <HeightSlider
            value={height}
            onChange={setHeight}
            min={HEIGHT_MIN}
            max={HEIGHT_MAX}
            onDragChange={setDragging}
          />
        </Section>

        {/* Hairline divider — same vocabulary as tu-ritmo, so the two
            sections feel like two pieces of one base. */}
        <View style={styles.divider} />

        <Section question="¿qué cuerpo lee Stelar?">
          <SexPills value={sex} onChange={setSex} />
          <Text style={styles.caveat}>Es solo para el cálculo. No identidad.</Text>
        </Section>
      </ScrollView>
    </WizardLayout>
  )
}

/* ─────────────────────── Section ─────────────────────── */

function Section({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{question}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

/* ───────────────────── Full-screen star sky ────────────────────── */

/*
 * CuerpoSky — full-screen painted depth for the FORM, the MIRRORED TWIN of
 * about-you's AboutYouSky. Same "U" composition: stars populate the
 * CEILING (y 0.06–0.20) and the FLOOR (y 0.80–0.94), and the central band
 * (y 0.30–0.72, where the slider + pills live) is left EMPTY. Dust rises
 * only along the EDGES. Same three strata + parallax (2/5/9 px) on the
 * orbit clock, dust on the dust clock.
 *
 * The dense ceiling cluster is mirrored to the RIGHT (about-you weights the
 * dense micro cluster slightly left; here it leans right) so the two skies
 * feel reflected without being identical.
 *
 * COOL WISP — a single wide-and-LOW cool ellipse (ciclo #B5C4DD) in the
 * media-baja zone (cy 0.66) that breathes very faintly on the dust clock.
 * It carries the lower half on its own — depth without a free-floating
 * focal star, keeping the manifiesto's central channel clear.
 *
 * CONSTELLATION-SAFE: no connected points, no figure, no glyph, no
 * bloom-on-valid — it is pure ambient depth.
 *
 * Gradient ids are namespaced `cuerpo-*` so they never collide with
 * about-you's `aboutyou-*` defs.
 */
const CEIL_FAR: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.12, y: 0.07, r: 0.6, opacity: 0.1 },
  { x: 0.88, y: 0.09, r: 0.7, opacity: 0.12 },
  { x: 0.5, y: 0.06, r: 0.5, opacity: 0.08 },
  { x: 0.3, y: 0.15, r: 0.6, opacity: 0.09 },
  { x: 0.72, y: 0.17, r: 0.5, opacity: 0.08 },
]
const CEIL_MID: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.18, y: 0.12, r: 0.8, opacity: 0.2 },
  { x: 0.82, y: 0.14, r: 0.7, opacity: 0.22 },
  { x: 0.6, y: 0.1, r: 0.7, opacity: 0.2 },
  { x: 0.4, y: 0.19, r: 0.7, opacity: 0.18 },
]
// Dense micro cluster leans RIGHT (mirror of about-you, which leans left).
const CEIL_MICRO: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.74, y: 0.1, r: 1.0, opacity: 0.36 },
  { x: 0.22, y: 0.08, r: 0.9, opacity: 0.32 },
  { x: 0.46, y: 0.18, r: 0.85, opacity: 0.3 },
]

// FLOOR strata.
const FLOOR_FAR: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.1, y: 0.84, r: 0.6, opacity: 0.1 },
  { x: 0.9, y: 0.86, r: 0.7, opacity: 0.12 },
  { x: 0.34, y: 0.92, r: 0.5, opacity: 0.08 },
  { x: 0.66, y: 0.9, r: 0.6, opacity: 0.1 },
]
const FLOOR_MID: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.16, y: 0.88, r: 0.8, opacity: 0.2 },
  { x: 0.86, y: 0.82, r: 0.7, opacity: 0.22 },
  { x: 0.5, y: 0.94, r: 0.7, opacity: 0.2 },
]
const FLOOR_MICRO: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.76, y: 0.86, r: 1.0, opacity: 0.34 },
  { x: 0.2, y: 0.9, r: 0.9, opacity: 0.3 },
  { x: 0.54, y: 0.81, r: 0.85, opacity: 0.3 },
  { x: 0.38, y: 0.85, r: 0.8, opacity: 0.28 },
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
  { x: 0.1, baseR: 0.9, period: 1.05, sway: 7, opacity: 0.34, phase: 0.1 },
  { x: 0.88, baseR: 0.8, period: 0.95, sway: 8, opacity: 0.3, phase: 0.5 },
  { x: 0.12, baseR: 0.65, period: 1.2, sway: 6, opacity: 0.26, phase: 0.7 },
  { x: 0.86, baseR: 0.7, period: 1.12, sway: 7, opacity: 0.28, phase: 0.3 },
]

function CuerpoSky({ dust, orbit }: { dust: SharedValue<number>; orbit: SharedValue<number> }) {
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
  // A wide, low ellipse of cool ciclo light in the media-baja zone (cy
  // 0.66). It breathes between 0.04 and 0.06 on the 18 s dust clock —
  // opacity only (numeric, UI-thread safe). It carries the lower half as
  // ambient depth.
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
          <RadialGradient id="cuerpo-starGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          {/* Cool wisp — silver-blue ciclo, faint, falls off to nothing. */}
          <RadialGradient id="cuerpo-coolWisp" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.dimension.ciclo} stopOpacity="0.06" />
            <Stop offset="1" stopColor={colors.dimension.ciclo} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Cool wisp — wide-and-low ellipse in the media-baja zone (cy
            0.66). Breathes faintly on the dust clock; depth without a
            free-floating focal point. */}
        <AnimatedEllipse
          cx={0.5 * SKY_W}
          cy={0.66 * SKY_H}
          rx={0.55 * SKY_W}
          ry={0.06 * SKY_H}
          fill="url(#cuerpo-coolWisp)"
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
                fill="url(#cuerpo-starGlow)"
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
                fill="url(#cuerpo-starGlow)"
                opacity={0.15}
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
                fill="url(#cuerpo-starGlow)"
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
                fill="url(#cuerpo-starGlow)"
                opacity={0.15}
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
}

/* ─────────────────────── Painted galaxy texture ─────────────────────── */

/*
 * NebulaWash — the painterly base layer, cloned LOCALLY from about-you and
 * MIRRORED for this FORM. The same painted galaxy PNG blown up to ~150% of
 * the reference width so it bleeds past every edge and reads as nebular
 * TEXTURE. Pivoted to the lower-RIGHT corner (cx 82% / cy 92% — the mirror
 * of about-you's 18%) and rotated -22° (mirror of +22°), then dropped to
 * whisper opacity.
 *
 * The vertical fade (to transparent by offset 0.62) is identical to
 * about-you so nothing crosses under the slider in the central channel.
 *
 * Only the PNG OPACITY breathes (0.08 ↔ 0.11) on the shared 5 s clock.
 * Transform / size / position are STATIC. Gradient id is `cuerpo-*`.
 */
function NebulaWash({ clock }: { clock: SharedValue<number> }) {
  const SKY_W = 360
  const SKY_H = 760

  const IMG_W = SKY_W * 1.5
  const IMG_H = IMG_W // square source art
  // Pivot lower-RIGHT: (82% w, 92% h) — the mirror of about-you's 18%.
  const PIVOT_X = SKY_W * 0.82
  const PIVOT_Y = SKY_H * 0.92
  const IMG_X = PIVOT_X - IMG_W / 2
  const IMG_Y = PIVOT_Y - IMG_H / 2

  const imgProps = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    return { opacity: 0.08 + w * 0.03 }
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
          {/* Vertical fade — bg opaque at the top → transparent by 0.62 so
              the PNG's upper edge melts before the central slider channel. */}
          <SvgLinearGradient id="cuerpo-nebulaFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.bg} stopOpacity="1" />
            <Stop offset="0.62" stopColor={colors.bg} stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>

        {/* Painted galaxy — rotated -22° (mirror), lower-right, breathing. */}
        <AnimatedG animatedProps={imgProps}>
          <G transform={`rotate(-22 ${PIVOT_X} ${PIVOT_Y})`}>
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

        {/* Fade the PNG's top edge into bg (no seam in the centre). */}
        <Rect x={0} y={0} width={SKY_W} height={SKY_H} fill="url(#cuerpo-nebulaFade)" />
      </Svg>
    </View>
  )
}

/* ─────────────────────── SexPills ─────────────────────── */

function SexPills({
  value,
  onChange,
}: {
  value: BiologicalSex | null
  onChange: (next: BiologicalSex) => void
}) {
  const handle = (next: BiologicalSex) => {
    Haptics.selectionAsync().catch(() => {})
    onChange(next)
  }
  return (
    <View style={styles.pillsRow}>
      <SexPill
        label="Femenino"
        selected={value === 'female'}
        dim={value === 'male'}
        onPress={() => handle('female')}
      />
      <SexPill
        label="Masculino"
        selected={value === 'male'}
        dim={value === 'female'}
        onPress={() => handle('male')}
      />
    </View>
  )
}

function SexPill({
  label,
  selected,
  dim,
  onPress,
}: {
  label: string
  selected: boolean
  dim: boolean
  onPress: () => void
}) {
  // Scale spring (unchanged) — the existing tactile bounce on selection.
  const scale = useSharedValue(1)
  useEffect(() => {
    scale.value = withSpring(selected ? 1.03 : 1, { damping: 16, stiffness: 220 })
    return () => cancelAnimation(scale)
  }, [selected, scale])
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  // Glow crossfade — the selected pill's magenta halo fades IN/OUT on
  // OPACITY (200 ms / ease-out-quad, the twin compás of about-you's
  // hairline ignition). We NEVER animate shadowRadius/shadowOpacity
  // numerically (not on the RN animated fast-path); instead a dedicated
  // glow View carries the static iOS shadow and only its opacity tweens.
  const glow = useSharedValue(selected ? 1 : 0)
  useEffect(() => {
    glow.value = withTiming(selected ? 1 : 0, { duration: 200, easing: Easing.out(Easing.quad) })
    return () => cancelAnimation(glow)
  }, [selected, glow])
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }))

  return (
    <Animated.View style={[styles.pillWrap, animatedStyle]}>
      {/* Glow layer — static magenta iOS shadow, crossfaded by opacity.
          Sits behind the pill body so the halo blooms under it. Android:
          View shadows don't blur → degrades to a harmless transparent
          rounded rect (iOS is the validation platform). */}
      <Animated.View style={[styles.pillGlow, glowStyle]} pointerEvents="none" />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        android_ripple={{ color: 'rgba(217, 39, 102, 0.18)', borderless: false }}
        style={({ pressed }) => [pressed && styles.pillPressed]}
      >
        {selected ? (
          <LinearGradient
            colors={['rgba(217,39,102,0.28)', 'rgba(217,39,102,0.12)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[styles.pill, styles.pillOn]}
          >
            <Text style={[styles.pillLabel, styles.pillLabelOn]}>{label}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.pill, styles.pillOff, dim && styles.pillDim]}>
            <Text style={[styles.pillLabel, dim && styles.pillLabelDim]}>{label}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  )
}

/* ─────────────────────── Styles ─────────────────────── */

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    marginTop: 36,
  },
  sectionLabel: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.headingLg,
    lineHeight: 26,
    color: colors.leche,
    opacity: 0.6,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  sectionBody: {
    marginTop: 18,
  },
  divider: {
    height: 1,
    marginTop: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  caveat: {
    marginTop: 14,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    // bone (not niebla) — homogeneity with about-you / atribución's quiet
    // labels. Sensitive data: it must read neutral and still, NO glow.
    color: colors.bone,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  /* Sex pills. Horizontal padding insets the pills 14 px inside the row so
     the selected pill has room to scale (1.03) AND project its magenta glow
     without the ScrollView's implicit overflow:hidden clipping the edges. */
  pillsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
  },
  pillWrap: {
    flex: 1,
  },
  /* Glow layer — fills the pill footprint, carries the static magenta iOS
     shadow, crossfaded by opacity only. borderRadius matches the pill so
     the halo blooms from the pill's rounded silhouette. */
  pillGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 100,
    backgroundColor: 'transparent',
    shadowColor: colors.magenta,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  pillPressed: {
    opacity: 0.88,
  },
  pill: {
    height: 56,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOff: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  pillDim: {
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  pillOn: {
    borderColor: colors.magenta,
  },
  pillLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  pillLabelOn: {
    color: colors.leche,
  },
  pillLabelDim: {
    color: 'rgba(255, 255, 255, 0.35)',
  },
})
