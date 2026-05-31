import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  G,
  Image as SvgImage,
  LinearGradient,
  Rect,
  RadialGradient,
  Stop,
} from 'react-native-svg'

import {
  AtmosphericSky,
  ChoiceChips,
  DustMote,
  StepHeader,
  WarmBloomField,
  WizardLayout,
  type Choice,
} from '@/features/onboarding/components'
import { type AcquisitionSource } from '@/features/profile/api'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const AnimatedG = Animated.createAnimatedComponent(G)

// Painted galaxy used as a whisper-low background texture (P1). The same
// PNG que-hace ships as the SEMANA orb — here it bleeds past the edges as
// abstract nebular texture, never read as an object.
const NEBULA_ART = require('@/assets/orbits-art/orbit-week-art.png')

const OPTIONS: readonly Choice<AcquisitionSource>[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'app_store', label: 'Búsqueda en App Store' },
  { value: 'friends_family', label: 'Por una amiga' },
  { value: 'influencer', label: 'De una influencer' },
  { value: 'other', label: 'Otra' },
]

/*
 * Step 3 — atribución. Marketing analytics question, low-friction (one
 * tap, optional). The team uses this to measure which channel converts;
 * without it, growth budget gets spent blind.
 *
 * Skip path lands the same as picking something — but the skip path
 * saves null so we can distinguish "didn't say" from "said other".
 *
 * NO COSMIC ANCHOR (illustrator + manifiesto pass): the prior bottom
 * "cosmic anchor" body + its "Gracias." / "Está bien. Seguimos." phrases
 * were removed. "Gracias." in the coach's serif-italic over a MARKETING
 * question lends false emotional warmth (manifiesto: italic = coach voice
 * only) — and the StepHeader hint ("Solo para saber cómo nos encontraste.")
 * already closes the beat. The screen is now chips + a richer painterly
 * sky, no closing body.
 *
 * ATMOSPHERE PARITY + ELEVATION (illustrator pass): steps 1/2 paint a
 * full-screen sky that the orb PNGs cover. Here the sky is seen ALONE, so
 * the old four-coaxial warm wash read as a flat magenta blob. The sky is
 * elevated to a painterly/Genshin depth by stacking, back→front:
 *   1. NebulaWash      — the painted galaxy PNG, rotated, descentred,
 *                        whisper-low (0.12), faded to black at the top so
 *                        it never cuts under the chips → painterly texture.
 *   2. AtmosphericSky  — the cool glow, pulled up-mid (42%/60%/64%) so the
 *                        cold recedes (aerial perspective).
 *   3. WarmBloomField  — variant="exposed": de-coaxialised warm wash +
 *                        organic nebula border + layered haze bands.
 *   4. AtribucionSky   — star strata + dust at the front (density raised).
 *
 * The three clocks (5 s / 18 s / 40 s) are created ONCE on the screen and
 * shared by every atmosphere layer so there is one compás.
 */
export default function AtribucionScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const [source, setSource] = useState<AcquisitionSource | null>(
    (profile?.acquisition_source as AcquisitionSource | null) ?? null,
  )
  const [skipped, setSkipped] = useState(false)

  // Personalised eyebrow was "Una curiosidad · {firstName}". That
  // read as a debug data-row when the name landed in caps next to
  // the section label. The screen names itself; we drop the suffix.
  const eyebrow = 'Una curiosidad'

  const canContinue = source !== null || skipped

  // Shared clocks for the whole step — created ONCE here so every
  // atmosphere layer (NebulaWash, WarmBloomField, star strata + dust)
  // breathes on the SAME values (no duplicated shared values, same
  // periods as steps 1/2 → same compás):
  //   clock  5 s  warm-field breath + nebula-texture breath
  //   dust  18 s  cosmic-dust drift
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

  const handleContinue = () => {
    if (skipped) {
      router.replace('/onboarding/day-one')
      return
    }
    if (!source) return
    updateProfile.mutate(
      { acquisition_source: source },
      { onSuccess: () => router.replace('/onboarding/day-one') },
    )
  }

  const handleSkip = () => {
    setSkipped((prev) => !prev)
    if (!skipped) {
      setSource(null)
    }
  }

  return (
    <WizardLayout
      step={3}
      showProgress={false}
      showBack={false}
      canContinue={canContinue}
      loading={updateProfile.isPending}
      errorMessage={updateProfile.error?.message}
      onContinue={handleContinue}
      continueLabel="Continuar"
      ctaVariant="soft"
      ctaTransform="none"
      atmosphere={
        <>
          {/* 1. Painterly texture — the painted galaxy, rotated /
              descentred / whisper-low, faded to black at the top so it
              never cuts under the chips. */}
          <NebulaWash clock={clock} />
          {/* 2. Shared cool glow — pulled up-mid so the cold recedes
              (aerial perspective); the warm lives lower. */}
          <AtmosphericSky glow={{ cx: '42%', cy: '60%', r: '64%' }} />
          {/* 3. Deep warm atmosphere — EXPOSED variant: de-coaxialised
              wash + organic nebula border + layered haze bands. */}
          <WarmBloomField clock={clock} variant="exposed" />
          {/* 4. Painted depth — star strata + dust, full-screen,
              whisper-low, hidden from VoiceOver. */}
          <AtribucionSky dust={dust} orbit={orbit} />
        </>
      }
    >
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StepHeader
          eyebrow={eyebrow}
          eyebrowColor="magenta"
          question={'¿Dónde escuchaste\nde Stelar?'}
          questionEmphasis="escuchaste"
          hint="Solo para saber cómo nos encontraste."
        />

        {/* Single-select group — chips + the opt-out form ONE logical
            radiogroup so VoiceOver announces the mutual exclusion
            (picking a chip clears skip and vice-versa). */}
        <View
          style={styles.chipsBlock}
          accessibilityRole="radiogroup"
          accessibilityLabel="¿Dónde escuchaste de Stelar?"
        >
          <ChoiceChips
            options={OPTIONS}
            value={skipped ? null : source}
            onChange={(next) => {
              setSource(next)
              setSkipped(false)
            }}
          />

          {/* Quiet opt-out — same vocabulary as tu-ciclo's "Prefiero no
              decir": a small dot + lowercase text, set apart so it reads
              as the meta-option, not a 7th equal-weight chip. It is a
              radio inside the group above so it deselects (and is
              deselected by) the chips. */}
          <Pressable
            onPress={handleSkip}
            style={styles.skipRow}
            accessibilityRole="radio"
            accessibilityLabel="Prefiero no decir"
            accessibilityState={{ selected: skipped }}
          >
            <View style={[styles.skipDot, skipped && styles.skipDotOn]} />
            <Text style={[styles.skipLabel, skipped && styles.skipLabelOn]}>Prefiero no decir</Text>
          </Pressable>
        </View>
      </ScrollView>
    </WizardLayout>
  )
}

/* ─────────────────────── Painted galaxy texture ─────────────────────── */

/*
 * NebulaWash (P1) — the painterly base layer. A single painted galaxy
 * PNG (the SEMANA orb art) blown up to ~150% of the screen width so it
 * bleeds past every edge and reads as nebular TEXTURE, never an object.
 * Pushed down-right (cx ≈ 68% / cy ≈ 88%) and rotated −18° so it sits
 * asymmetric, then dropped to whisper opacity (~0.12). A vertical
 * bg(0)→bg(0.5) gradient over the PNG fades its top edge into black so
 * there is no hard seam under the chips.
 *
 * Only the PNG OPACITY breathes (0.10 ↔ 0.14) on the shared 5 s clock —
 * one useAnimatedProps, no new clock. Transform / size / position are
 * STATIC (never animate transform or a length as a string %, per the
 * WarmBloomField lesson). pointerEvents none, hidden from VoiceOver.
 *
 * Coordinates are in a reference 360×760 box stretched to absoluteFill,
 * so the wash scales with the device.
 */
function NebulaWash({ clock }: { clock: SharedValue<number> }) {
  const SKY_W = 360
  const SKY_H = 760

  // ~150% of the reference width so the PNG sangra por los bordes.
  const IMG_W = SKY_W * 1.5
  const IMG_H = IMG_W // square source art
  // Centre the image on (68% w, 88% h), then top-left = centre − half.
  const PIVOT_X = SKY_W * 0.68
  const PIVOT_Y = SKY_H * 0.88
  const IMG_X = PIVOT_X - IMG_W / 2
  const IMG_Y = PIVOT_Y - IMG_H / 2

  const imgProps = useAnimatedProps(() => {
    'worklet'
    const w = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    return { opacity: 0.1 + w * 0.04 }
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
          {/* Vertical fade — bg opaque at the top → transparent by the
              mid so the PNG's upper edge melts into black under the
              chips, no hard seam. */}
          <LinearGradient id="atrib-nebulaFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.bg} stopOpacity="1" />
            <Stop offset="0.5" stopColor={colors.bg} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Painted galaxy — rotated, descentred, breathing opacity only. */}
        <AnimatedG animatedProps={imgProps}>
          <G transform={`rotate(-18 ${PIVOT_X} ${PIVOT_Y})`}>
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

        {/* Fade the PNG's top edge into bg (no hard seam under chips). */}
        <Rect x={0} y={0} width={SKY_W} height={SKY_H} fill="url(#atrib-nebulaFade)" />
      </Svg>
    </View>
  )
}

/* ───────────────────── Full-screen star sky ────────────────────── */

// Star strata cloned from que-hace, density reduced. x/y are 0→1
// fractions of the screen; parallax amplitude grows toward the viewer
// (far 2px / mid 5px / micro 9px). Concentrated in the LOWER half so the
// depth pools under the chips, never behind the chips' text. With
// xMidYMid slice on a tall Pro Max viewport the 360×760 box is scaled to
// fill width and vertically cropped, which can lift the band upward; so
// the band is held to y≥0.58 to keep stars clear of the chips/skip text.
const FAR_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.1, y: 0.58, r: 0.6, opacity: 0.1 },
  { x: 0.92, y: 0.6, r: 0.7, opacity: 0.12 },
  { x: 0.32, y: 0.68, r: 0.5, opacity: 0.08 },
  { x: 0.74, y: 0.74, r: 0.6, opacity: 0.1 },
  { x: 0.5, y: 0.87, r: 0.5, opacity: 0.08 },
  { x: 0.2, y: 0.83, r: 0.5, opacity: 0.09 },
]

const MID_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.16, y: 0.62, r: 0.8, opacity: 0.24 },
  { x: 0.84, y: 0.6, r: 0.7, opacity: 0.22 },
  { x: 0.9, y: 0.76, r: 0.9, opacity: 0.26 },
  { x: 0.12, y: 0.78, r: 0.8, opacity: 0.24 },
  { x: 0.62, y: 0.66, r: 0.7, opacity: 0.2 },
  { x: 0.38, y: 0.82, r: 0.7, opacity: 0.22 },
]

// Micro-stars — nearest field, warm, halo + parallax. Density raised
// (P4): 5 → 8 motes, three of them WARM stars added low in the y
// 0.78–0.92 band to populate the lower half near the new warm bloom.
const MICRO_STARS: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 0.24, y: 0.68, r: 1.1, opacity: 0.42 },
  { x: 0.8, y: 0.7, r: 1.0, opacity: 0.38 },
  { x: 0.5, y: 0.76, r: 0.9, opacity: 0.34 },
  { x: 0.14, y: 0.89, r: 1.0, opacity: 0.36 },
  { x: 0.7, y: 0.85, r: 0.9, opacity: 0.32 },
  // P4 — three extra warm stars in the lower band near the bloom.
  { x: 0.34, y: 0.92, r: 0.95, opacity: 0.34 },
  { x: 0.88, y: 0.8, r: 0.85, opacity: 0.3 },
  { x: 0.58, y: 0.9, r: 0.8, opacity: 0.28 },
]

// P4 — DUST density raised 4 → 6 motes, opacities +~0.06, rising through
// the lower half. They whisper behind the chips without competing.
const DUST: {
  x: number
  baseR: number
  period: number
  sway: number
  opacity: number
  phase: number
}[] = [
  { x: 0.22, baseR: 0.9, period: 1.05, sway: 9, opacity: 0.4, phase: 0.1 },
  { x: 0.52, baseR: 1.0, period: 0.95, sway: 11, opacity: 0.46, phase: 0.5 },
  { x: 0.78, baseR: 0.7, period: 1.15, sway: 8, opacity: 0.36, phase: 0.3 },
  { x: 0.4, baseR: 0.6, period: 1.25, sway: 12, opacity: 0.28, phase: 0.72 },
  { x: 0.66, baseR: 0.75, period: 1.1, sway: 10, opacity: 0.32, phase: 0.2 },
  { x: 0.32, baseR: 0.65, period: 1.2, sway: 9, opacity: 0.3, phase: 0.62 },
]

/*
 * Full-screen painted depth for step 3: three star strata + rising
 * dust, behind the content. The stars sit in the LOWER half (the chips
 * own the top, so the sky stays a whisper there). Differential parallax
 * (2/5/9px) on the 40 s orbit clock, dust on the 18 s clock. All
 * whisper-low alphas, pointerEvents none, hidden from VoiceOver (the
 * reading order is the chips, never the decorative sky).
 *
 * Uses screen-relative coordinates by sizing the inner Svg to a
 * reference 360×760 box and stretching it to absoluteFill — the star
 * positions are fractions so they scale with the device.
 */
function AtribucionSky({ dust, orbit }: { dust: SharedValue<number>; orbit: SharedValue<number> }) {
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
          {/* Tight white falloff so micro-stars glow rather than read
              as flat drawn dots (equivalent to que-hace's qh-starGlow). */}
          <RadialGradient id="atrib-starGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Cosmic dust rising through the lower half. */}
        {DUST.map((d, i) => (
          <DustMote key={`sky-dust-${i}`} {...d} clock={dust} stage={SKY_H} fill="#F8DBCE" />
        ))}

        {/* Far COOL stars — distant silver-blue stratum, 2px parallax. */}
        <AnimatedG animatedProps={farDriftProps}>
          {FAR_STARS.map((s, i) => (
            <G key={`far-${i}`}>
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r * 2.4}
                fill="url(#atrib-starGlow)"
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

        {/* Mid stars — middle depth, intermediate tint, 5px drift. */}
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

        {/* Micro stars — nearest field, warm, halo + 9px parallax +
            group twinkle. Halo first so the point sits on a glow. */}
        <AnimatedG animatedProps={microGroupProps}>
          {MICRO_STARS.map((s, i) => (
            <G key={`micro-${i}`}>
              <Circle
                cx={s.x * SKY_W}
                cy={s.y * SKY_H}
                r={s.r * 2.5}
                fill="url(#atrib-starGlow)"
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

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  chipsBlock: {
    marginTop: 28,
  },
  /* Quiet opt-out, same pattern as tu-ciclo/frictions. */
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    marginTop: 14,
    gap: 10,
  },
  skipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  skipDotOn: {
    backgroundColor: colors.magenta,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    shadowColor: colors.magenta,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  skipLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 13.5,
    // Bumped niebla → bone: niebla sits at the edge of contrast at
    // 13.5pt. niebla is now reserved for the dimmed dot only.
    color: colors.bone,
    letterSpacing: 0.3,
  },
  skipLabelOn: {
    color: colors.leche,
  },
})
