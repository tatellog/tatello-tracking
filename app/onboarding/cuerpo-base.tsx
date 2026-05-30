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
} from 'react-native-reanimated'
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg'

import { HeightSlider, StepHeader, WizardLayout } from '@/features/onboarding/components'
import { type BiologicalSex } from '@/features/profile/api'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedLine = Animated.createAnimatedComponent(Line)

const HEIGHT_MIN = 140
const HEIGHT_MAX = 200
const HEIGHT_DEFAULT = 170

/*
 * Cuerpo — Screen 2 of the split "Cuéntame de ti" pair. Asks the
 * height + biological sex Stelar needs to calibrate energy
 * estimates. Lives at /onboarding/cuerpo-base, between about-you
 * and weight.
 *
 * Visual upgrades over the previous version:
 *   • Both section labels read as parallel questions ("¿cuánto
 *     mides?" / "¿qué cuerpo lee Stelar?"), not a question + a
 *     disclaimer-style label.
 *   • A thin gradient hairline separates the two sections so they
 *     read as "two pieces of one base" rather than two stacked
 *     forms.
 *   • A calibration preview below the sex pills delivers on the
 *     promise of the title: a small luminous body that *brightens
 *     as the user completes inputs*, with a copy line that goes
 *     from "Stelar está leyendo…" → "Stelar ya tiene tu base." once
 *     both inputs are set. This both gives feedback for the
 *     calibration claim and fills the empty space that used to sit
 *     between the pills and the CTA.
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
      totalSteps={12}
      canContinue={canContinue}
      loading={updateProfile.isPending}
      errorMessage={updateProfile.error?.message}
      onContinue={handleContinue}
      continueLabel="Continuar"
      ctaVariant="soft"
      ctaTransform="none"
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
          <HeightSlider value={height} onChange={setHeight} min={HEIGHT_MIN} max={HEIGHT_MAX} />
        </Section>

        {/* Hairline divider — same vocabulary as tu-ritmo, so the two
            sections feel like two pieces of one base. */}
        <View style={styles.divider} />

        <Section question="¿qué cuerpo lee Stelar?">
          <SexPills value={sex} onChange={setSex} />
          <Text style={styles.caveat}>Es solo para el cálculo. No identidad.</Text>
        </Section>

        {/* Calibration preview — visually confirms the promise of the
            title. A small star at the bottom brightens as the user
            completes inputs, and the copy line shifts state. */}
        <CalibrationPreview heightValid={heightValid} sexValid={sexValid} />
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

/* ─────────────────────── CalibrationPreview ─────────────────────── */

/** A small luminous body at the bottom of the screen that brightens
 *  as the user completes the two inputs. Idle: dim, slowly breathing.
 *  One input set: half-bright. Both set: full magenta with bloom +
 *  the copy line confirms "Stelar ya tiene tu base."
 *
 *  Acts as both feedback for the calibration claim and a visual
 *  anchor for the bottom half of the screen. */
function CalibrationPreview({
  heightValid,
  sexValid,
}: {
  heightValid: boolean
  sexValid: boolean
}) {
  const completion = (heightValid ? 0.5 : 0) + (sexValid ? 0.5 : 0)

  // Tween the completion value so the brightness changes feel
  // animated, not jumpy.
  const lit = useSharedValue(completion)
  useEffect(() => {
    lit.value = withSpring(completion, { damping: 18, stiffness: 180 })
  }, [completion, lit])

  // Slow shared breath so the body stays alive even when idle.
  const breath = useSharedValue(0)
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [breath])

  // Single atmospheric bloom — one Circle with a RadialGradient
  // fill (magenta → transparent). Replaces the previous stack of 3
  // Circles which produced visible concentric ring edges instead of
  // smooth bloom. Radius + opacity ride breath + lit together.
  const bloomProps = useAnimatedProps(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(breath.value * 2 * Math.PI)
    return {
      r: 36 + lit.value * 8 + b * 3,
      opacity: 0.45 + lit.value * 0.4 + b * 0.08,
    }
  })
  const coreProps = useAnimatedProps(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(breath.value * 2 * Math.PI)
    return {
      r: 3.6 + lit.value * 1.6 + b * 0.3,
    }
  })
  // Diagonal spikes only — the cardinal cross (+) reads as a target
  // crosshair no matter how soft. Kept the × so the body still
  // twinkles, but lost the +.
  const diagonalSpikes = useAnimatedProps(() => {
    'worklet'
    return { opacity: 0.16 + lit.value * 0.3 }
  })
  // 8 fine radial rays at jittered angles — organic starburst that
  // reads like real long-exposure starlight, not a compass.
  const raysProps = useAnimatedProps(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(breath.value * 2 * Math.PI)
    return { opacity: 0.18 + lit.value * 0.5 + b * 0.06 }
  })
  // Dust drifts OUTSIDE the bloom now — positioned far enough out
  // that it reads as cosmic dust orbiting, not as washed-out flecks
  // inside the halo.
  const dustProps = useAnimatedProps(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(breath.value * 2 * Math.PI)
    return { opacity: 0.35 + lit.value * 0.45 + b * 0.1 }
  })

  // Copy fades between two states.
  const idleOpacity = useAnimatedStyle(() => ({
    opacity: 1 - lit.value,
  }))
  const doneOpacity = useAnimatedStyle(() => ({
    opacity: Math.max(0, lit.value * 2 - 1),
  }))

  // Larger canvas now — gives the dust room to live OUTSIDE the
  // bloom radius (was 110×90, dust ended up inside the bloom).
  const W = 160
  const H = 130
  const CX = W / 2
  const CY = H / 2

  // 8 thin radial rays — deterministic jittered angles + varied
  // lengths so the starburst reads as organic light, not a compass
  // rose. Each is rendered as one Line emanating from the centre.
  const RAYS: { angle: number; length: number }[] = [
    { angle: -1.5, length: 22 },
    { angle: -0.65, length: 17 },
    { angle: 0.2, length: 24 },
    { angle: 0.95, length: 19 },
    { angle: 1.6, length: 16 },
    { angle: 2.4, length: 23 },
    { angle: 3.1, length: 20 },
    { angle: -2.55, length: 18 },
  ]

  // 6 dust particles OUTSIDE the bloom (~36-50 px from center) so
  // they read as cosmic dust orbiting, not flecks inside the halo.
  const DUST = [
    { dx: -42, dy: -28, r: 1.0 },
    { dx: 46, dy: -18, r: 1.3 },
    { dx: 38, dy: 32, r: 0.9 },
    { dx: -48, dy: 22, r: 1.1 },
    { dx: -16, dy: -40, r: 0.8 },
    { dx: 52, dy: 14, r: 0.7 },
  ]

  return (
    <View style={styles.calibration}>
      <Svg width={W} height={H}>
        <Defs>
          <RadialGradient id="calibration-core" cx="50%" cy="50%" r="60%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="40%" stopColor="#FBD7E3" />
            <Stop offset="100%" stopColor={colors.magenta} />
          </RadialGradient>
          {/* Bloom gradient: full magenta at centre, transparent at
              the edge. Single Circle filled with this looks like real
              atmospheric falloff — no concentric ring artefacts. */}
          <RadialGradient id="calibration-bloom" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.magenta} stopOpacity={0.6} />
            <Stop offset="40%" stopColor={colors.magenta} stopOpacity={0.22} />
            <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* Single atmospheric bloom — RadialGradient fill. Radius +
            overall opacity ride breath + lit. No ring edges. */}
        <AnimatedCircle cx={CX} cy={CY} fill="url(#calibration-bloom)" animatedProps={bloomProps} />

        {/* 8 fine radial rays at jittered angles — organic starburst
            (no compass cross). */}
        {RAYS.map((ray, i) => (
          <AnimatedLine
            key={`ray-${i}`}
            x1={CX}
            y1={CY}
            x2={CX + Math.cos(ray.angle) * ray.length}
            y2={CY + Math.sin(ray.angle) * ray.length}
            stroke="#FBD7E3"
            strokeWidth={0.5}
            strokeLinecap="round"
            animatedProps={raysProps}
          />
        ))}

        {/* 2 diagonal spikes — light × shape that makes the body
            twinkle without reading as crosshair. */}
        <AnimatedLine
          x1={CX - 12}
          y1={CY - 12}
          x2={CX + 12}
          y2={CY + 12}
          stroke="#FFFFFF"
          strokeWidth={0.6}
          strokeLinecap="round"
          animatedProps={diagonalSpikes}
        />
        <AnimatedLine
          x1={CX + 12}
          y1={CY - 12}
          x2={CX - 12}
          y2={CY + 12}
          stroke="#FFFFFF"
          strokeWidth={0.6}
          strokeLinecap="round"
          animatedProps={diagonalSpikes}
        />

        {/* Core with radial gradient. */}
        <AnimatedCircle cx={CX} cy={CY} fill="url(#calibration-core)" animatedProps={coreProps} />

        {/* Dust drifting OUTSIDE the bloom — reads as cosmic dust
            orbiting the body, not as washed-out flecks inside. */}
        {DUST.map((d, i) => (
          <AnimatedCircle
            key={i}
            cx={CX + d.dx}
            cy={CY + d.dy}
            r={d.r}
            fill="#FBD7E3"
            animatedProps={dustProps}
          />
        ))}
      </Svg>

      <View style={styles.calibrationCopyWrap}>
        <Animated.Text style={[styles.calibrationCopyIdle, idleOpacity]}>
          Stelar está leyendo…
        </Animated.Text>
        <Animated.Text style={[styles.calibrationCopyDone, doneOpacity]}>
          Stelar ya tiene tu base.
        </Animated.Text>
      </View>
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
  const scale = useSharedValue(1)
  useEffect(() => {
    scale.value = withSpring(selected ? 1.03 : 1, { damping: 16, stiffness: 220 })
  }, [selected, scale])
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View style={[styles.pillWrap, animatedStyle]}>
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
    color: colors.niebla,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  /* Calibration preview — fills the bottom + delivers on the title. */
  calibration: {
    marginTop: 40,
    alignItems: 'center',
    gap: 6,
  },
  calibrationCopyWrap: {
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calibrationCopyIdle: {
    position: 'absolute',
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
    letterSpacing: 0.1,
  },
  calibrationCopyDone: {
    position: 'absolute',
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.magenta,
    letterSpacing: 0.1,
  },
  /* Sex pills. Horizontal padding insets the pills 14 px inside the
     row so the selected pill has room to scale (1.03) AND project
     its magenta glow (shadowRadius 14) without the ScrollView's
     implicit overflow:hidden clipping the edges. (Negative outer
     margins don't escape the ScrollView's own clip rect — only an
     inner inset does.) */
  pillsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
  },
  pillWrap: {
    flex: 1,
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
    shadowColor: colors.magenta,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
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
