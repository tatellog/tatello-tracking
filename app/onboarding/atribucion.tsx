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
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg'

import {
  ChoiceChips,
  StepHeader,
  WizardLayout,
  type Choice,
} from '@/features/onboarding/components'
import { type AcquisitionSource } from '@/features/profile/api'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedLine = Animated.createAnimatedComponent(Line)

const OPTIONS: readonly Choice<AcquisitionSource>[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'app_store', label: 'Búsqueda en App Store' },
  { value: 'friends_family', label: 'Por una amiga' },
  { value: 'influencer', label: 'De una influencer' },
  { value: 'other', label: 'Otra' },
]

/*
 * Step 3 — atribución (moved up from step 10). Marketing analytics
 * question, low-friction (one tap, optional). Asked early — before
 * the personal data screens — so the user picks attribution while
 * still in "tell us about yourself" mode, not as a footnote after
 * the wizard's emotional peak. The team uses this to measure which
 * channel converts; without it, growth budget gets spent blind.
 *
 * Skip path lands the same as picking something — but the skip path
 * saves null so we can distinguish "didn't say" from "said other".
 *
 * Visual closure: a small cosmic anchor at the bottom thanks the
 * user for the answer ("Gracias por contarnos."), filling the void
 * below the chips and echoing the cuerpo-base / weight / tu-base
 * anchor pattern.
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

  const handleContinue = () => {
    if (skipped) {
      router.push('/onboarding/about-you')
      return
    }
    if (!source) return
    updateProfile.mutate(
      { acquisition_source: source },
      { onSuccess: () => router.push('/onboarding/about-you') },
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
      totalSteps={12}
      canContinue={canContinue}
      loading={updateProfile.isPending}
      errorMessage={updateProfile.error?.message}
      onContinue={handleContinue}
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
          hint="Nos ayuda a saber dónde vale la pena estar."
        />

        <View style={styles.chipsBlock}>
          <ChoiceChips
            options={OPTIONS}
            value={skipped ? null : source}
            onChange={(next) => {
              setSource(next)
              setSkipped(false)
            }}
          />
        </View>

        {/* Quiet opt-out — same vocabulary as tu-ciclo's "Prefiero no
            decir": a small dot + lowercase niebla text, set apart so
            it reads as the meta-option, not a 7th equal-weight chip. */}
        <Pressable
          onPress={handleSkip}
          style={styles.skipRow}
          accessibilityRole="button"
          accessibilityLabel="Prefiero no decir"
          accessibilityState={{ selected: skipped }}
        >
          <View style={[styles.skipDot, skipped && styles.skipDotOn]} />
          <Text style={[styles.skipLabel, skipped && styles.skipLabelOn]}>Prefiero no decir</Text>
        </Pressable>

        {/* Cosmic anchor — closes the question with the same body
            language as the baseline screens. Fades in 600 ms after
            the screen mounts so it lands as a quiet thanks beat. */}
        <ThankYouBody active={canContinue} />
      </ScrollView>
    </WizardLayout>
  )
}

/* ─────────────────────── Cosmic body ─────────────────────── */

/** Small luminous body + phrase that closes the attribution
 *  question. Idle (no selection yet): dim, breathes slowly with the
 *  prompt "Stelar te leerá igual." Once the user picks anything
 *  (including skip), the body brightens and the phrase shifts to a
 *  warm "Gracias por contarnos." */
function ThankYouBody({ active }: { active: boolean }) {
  const lit = useSharedValue(active ? 1 : 0.4)
  useEffect(() => {
    lit.value = withTiming(active ? 1 : 0.4, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    })
  }, [active, lit])

  const breath = useSharedValue(0)
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [breath])

  // Soft entrance — fades in 600 ms after mount so it lands after
  // the user has read the question.
  const mountIn = useSharedValue(0)
  useEffect(() => {
    const id = setTimeout(() => {
      mountIn.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) })
    }, 600)
    return () => clearTimeout(id)
  }, [mountIn])
  const wrapStyle = useAnimatedStyle(() => ({ opacity: mountIn.value }))

  const bloomProps = useAnimatedProps(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(breath.value * 2 * Math.PI)
    return {
      r: 38 + lit.value * 6 + b * 3,
      opacity: 0.4 + lit.value * 0.4 + b * 0.08,
    }
  })
  const coreProps = useAnimatedProps(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(breath.value * 2 * Math.PI)
    return { r: 3.6 + lit.value * 1.4 + b * 0.3 }
  })
  const diagonalSpikes = useAnimatedProps(() => {
    'worklet'
    return { opacity: 0.15 + lit.value * 0.3 }
  })
  const raysProps = useAnimatedProps(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(breath.value * 2 * Math.PI)
    return { opacity: 0.18 + lit.value * 0.45 + b * 0.06 }
  })
  const dustProps = useAnimatedProps(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(breath.value * 2 * Math.PI)
    return { opacity: 0.3 + lit.value * 0.45 + b * 0.1 }
  })

  const idleStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - lit.value),
  }))
  const doneStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, lit.value * 1.4 - 0.4),
  }))

  const W = 160
  const H = 130
  const CX = W / 2
  const CY = H / 2

  const RAYS = [
    { angle: -1.5, length: 22 },
    { angle: -0.65, length: 17 },
    { angle: 0.2, length: 24 },
    { angle: 0.95, length: 19 },
    { angle: 1.6, length: 16 },
    { angle: 2.4, length: 23 },
    { angle: 3.1, length: 20 },
    { angle: -2.55, length: 18 },
  ]
  const DUST = [
    { dx: -42, dy: -28, r: 1.0 },
    { dx: 46, dy: -18, r: 1.3 },
    { dx: 38, dy: 32, r: 0.9 },
    { dx: -48, dy: 22, r: 1.1 },
    { dx: -16, dy: -40, r: 0.8 },
    { dx: 52, dy: 14, r: 0.7 },
  ]

  return (
    <Animated.View style={[styles.anchor, wrapStyle]}>
      <Svg width={W} height={H}>
        <Defs>
          <RadialGradient id="atrib-core" cx="50%" cy="50%" r="60%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="40%" stopColor="#FBD7E3" />
            <Stop offset="100%" stopColor={colors.magenta} />
          </RadialGradient>
          <RadialGradient id="atrib-bloom" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.magenta} stopOpacity={0.6} />
            <Stop offset="40%" stopColor={colors.magenta} stopOpacity={0.22} />
            <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <AnimatedCircle cx={CX} cy={CY} fill="url(#atrib-bloom)" animatedProps={bloomProps} />

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

        <AnimatedCircle cx={CX} cy={CY} fill="url(#atrib-core)" animatedProps={coreProps} />

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

      <View style={styles.anchorCopyWrap}>
        <Animated.Text style={[styles.anchorCopyIdle, idleStyle]}>
          Stelar te leerá igual.
        </Animated.Text>
        <Animated.Text style={[styles.anchorCopyDone, doneStyle]}>
          Gracias por contarnos.
        </Animated.Text>
      </View>
    </Animated.View>
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
    color: colors.niebla,
    letterSpacing: 0.3,
  },
  skipLabelOn: {
    color: colors.leche,
  },
  /* Cosmic anchor at the bottom — closes the attribution beat. */
  anchor: {
    marginTop: 14,
    alignItems: 'center',
    gap: 4,
    paddingBottom: 24,
  },
  anchorCopyWrap: {
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  anchorCopyIdle: {
    position: 'absolute',
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13,
    color: colors.niebla,
    letterSpacing: 0.1,
  },
  anchorCopyDone: {
    position: 'absolute',
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 14,
    color: colors.magenta,
    letterSpacing: 0.1,
  },
})
