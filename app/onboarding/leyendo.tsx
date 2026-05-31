import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

import { WizardBackdrop } from '@/features/onboarding/components'
import { colors, typography } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/*
 * Build-up screen — sits between the last question (notificaciones)
 * and the reveal (appointment). 11 wizard pages of input deserve a
 * dramatic "Stelar is now reading you" moment instead of an instant
 * cut to the reveal. This screen holds for ~2.8 seconds with a
 * pulsing core and a rotating phrase, then auto-advances.
 *
 * Psychology: anticipation amplifies the dopamine hit of the reveal
 * that follows. Without this beat, the reveal feels too cheap for
 * the work the user just did.
 *
 * The base cosmic backdrop (starfield + Stelar presence) is mounted PER
 * SCREEN (its own <WizardBackdrop />, opaque colors.bg base) so the
 * slide transition fully occludes the screen behind it. The presence
 * breath is shared via WizardPresenceContext so it never restarts.
 */
const PHASES = [
  'Leyendo tu primera lectura',
  'Cruzando tus señales',
  'Encontrando lo que se mueve',
] as const

const TOTAL_DURATION_MS = 2800
const PHASE_DURATION_MS = Math.floor(TOTAL_DURATION_MS / PHASES.length)

export default function LeyendoScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [phaseIdx, setPhaseIdx] = useState(0)
  const t = useSharedValue(0)

  useEffect(() => {
    // Core breath — 1.4 s in/out cycle. Faster than the reveal's
    // settled breath so this screen reads as "actively working".
    t.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )

    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 1; i < PHASES.length; i++) {
      timers.push(setTimeout(() => setPhaseIdx(i), i * PHASE_DURATION_MS))
    }
    const advance = setTimeout(() => {
      router.replace('/onboarding/appointment')
    }, TOTAL_DURATION_MS)

    return () => {
      cancelAnimation(t)
      timers.forEach(clearTimeout)
      clearTimeout(advance)
    }
  }, [router, t])

  return (
    <View
      style={[
        styles.safe,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {/* Per-screen opaque backdrop (starfield + shared breathing
          presence) so the slide occludes and the breath never restarts. */}
      <WizardBackdrop />
      <View style={styles.stage}>
        <BuildingStar clock={t} />
      </View>
      <Animated.Text
        key={phaseIdx}
        entering={FadeIn.duration(420)}
        exiting={FadeOut.duration(360)}
        style={styles.phase}
      >
        {PHASES[phaseIdx]}
      </Animated.Text>
    </View>
  )
}

/* The growing star — three pulsing halos around a bright core. Same
 * cosmic vocabulary as the reveal's CosmicStar, but breathing fast
 * so the screen reads as "actively working" rather than "settled". */
function BuildingStar({ clock }: { clock: SharedValue<number> }) {
  const CX = 140
  const CY = 140
  const CORE_R = 14

  const outerProps = useAnimatedProps(() => {
    'worklet'
    const w = clock.value
    return { r: 90 + w * 18, opacity: 0.02 + w * 0.07 }
  })
  const midProps = useAnimatedProps(() => {
    'worklet'
    const w = clock.value
    return { r: 56 + w * 12, opacity: 0.08 + w * 0.12 }
  })
  const innerProps = useAnimatedProps(() => {
    'worklet'
    const w = clock.value
    return { r: 30 + w * 6, opacity: 0.18 + w * 0.18 }
  })
  const coreProps = useAnimatedProps(() => {
    'worklet'
    const w = clock.value
    return { r: CORE_R + w * 2 }
  })

  return (
    <Svg width={280} height={280} viewBox="0 0 280 280">
      <Defs>
        <RadialGradient id="leyendo-core" cx="50%" cy="50%" r="60%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="40%" stopColor="#FBD7E3" />
          <Stop offset="100%" stopColor="#9A2150" />
        </RadialGradient>
      </Defs>
      <AnimatedCircle animatedProps={outerProps} cx={CX} cy={CY} fill={colors.magenta} />
      <AnimatedCircle animatedProps={midProps} cx={CX} cy={CY} fill={colors.magenta} />
      <AnimatedCircle animatedProps={innerProps} cx={CX} cy={CY} fill={colors.magenta} />
      <AnimatedCircle animatedProps={coreProps} cx={CX} cy={CY} fill="url(#leyendo-core)" />
    </Svg>
  )
}

const styles = StyleSheet.create({
  // OPAQUE so the incoming screen occludes the outgoing one during the
  // slide; the per-screen WizardBackdrop paints the sky on top of this.
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phase: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 24,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 32,
    paddingBottom: 64,
  },
})
