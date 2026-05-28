import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
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

import { StepHeader, WheelPicker, WizardLayout } from '@/features/onboarding/components'
import { useInsertInitialWeight } from '@/features/profile/hooks'
import { saveSkipWeight } from '@/lib/onboardingFlags'
import { colors, typography } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedLine = Animated.createAnimatedComponent(Line)

const MIN_KG = 30
const MAX_KG = 200
const DEFAULT_KG = 70

/** Round to 1 decimal — avoids floating-point drift when composing
 *  integer + decimal/10. */
const round1 = (n: number) => Math.round(n * 10) / 10

/*
 * Weight — the body composition baseline. Optional via the
 * "aún no tengo báscula" skip; otherwise, the wheel picker collects
 * the decimal value (Mifflin-St Jeor needs precision; a stepper
 * would mean 700 taps for the range).
 *
 * The value lands in body_measurements (time series), not profiles,
 * so the first reading anchors the historical graph from day 1.
 *
 * Visual companion: a small cosmic body below the wheel that
 * confirms Stelar has the punto de partida — fills the bottom half
 * of the screen and echoes the cuerpo-base calibration body so the
 * three baseline screens (cuerpo-base → weight → tu-base) all carry
 * the same "Stelar is reading you" beat.
 */
export default function WeightScreen() {
  const router = useRouter()
  const insertWeight = useInsertInitialWeight()
  const [value, setValue] = useState<number>(DEFAULT_KG)
  const [skip, setSkip] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingError, setSavingError] = useState<string | null>(null)

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
      router.push('/onboarding/tu-base')
    } catch (e) {
      setSavingError(e instanceof Error ? e.message : 'No pudimos guardar tu peso.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WizardLayout
      step={6}
      totalSteps={12}
      canContinue={canContinue}
      loading={saving}
      errorMessage={savingError ?? insertWeight.error?.message ?? null}
      onContinue={handleContinue}
    >
      <StepHeader
        eyebrow="El punto de partida"
        eyebrowColor="magenta"
        question="Hoy pesas…"
        questionEmphasis="pesas"
        hint="No es un veredicto. Es solo de dónde empezamos."
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
              />
            </View>
            <Text style={styles.unitLabel}>kg</Text>
          </View>
        )}

        <Text style={styles.caveat}>Es solo el punto de partida.{'\n'}No es tu valor.</Text>

        <Text style={styles.skipLink} onPress={() => setSkip((prev) => !prev)} suppressHighlighting>
          {skip ? 'Sí tengo báscula' : 'Aún no tengo báscula'}
        </Text>

        {/* Cosmic anchor at the bottom — fills the void below the
            skip link, breathes constantly, and confirms with a single
            line that Stelar has the punto de partida. Same visual
            language as the cuerpo-base CalibrationPreview so the
            three baseline screens feel like one continuous read. */}
        <StartingPointBody active={!skip} />
      </View>
    </WizardLayout>
  )
}

/* ─────────────────────── Cosmic body ─────────────────────── */

/** Small cosmic body + phrase that anchors the bottom half of the
 *  screen. Always alive (breathes); brightens slightly when the user
 *  has a real weight (vs. skipped). */
function StartingPointBody({ active }: { active: boolean }) {
  const lit = useSharedValue(active ? 1 : 0.4)
  useEffect(() => {
    lit.value = withSpring(active ? 1 : 0.4, { damping: 18, stiffness: 180 })
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

  // Phrase only resolves to the magenta confirmation once the user
  // has actually committed to a weight (i.e., not skipped).
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

  // 8 radial rays at jittered angles + lengths — organic starburst,
  // no compass cross.
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

  // Dust orbiting OUTSIDE the bloom radius.
  const DUST = [
    { dx: -42, dy: -28, r: 1.0 },
    { dx: 46, dy: -18, r: 1.3 },
    { dx: 38, dy: 32, r: 0.9 },
    { dx: -48, dy: 22, r: 1.1 },
    { dx: -16, dy: -40, r: 0.8 },
    { dx: 52, dy: 14, r: 0.7 },
  ]

  return (
    <View style={styles.anchor}>
      <Svg width={W} height={H}>
        <Defs>
          <RadialGradient id="weight-core" cx="50%" cy="50%" r="60%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="40%" stopColor="#FBD7E3" />
            <Stop offset="100%" stopColor={colors.magenta} />
          </RadialGradient>
          <RadialGradient id="weight-bloom" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.magenta} stopOpacity={0.6} />
            <Stop offset="40%" stopColor={colors.magenta} stopOpacity={0.22} />
            <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <AnimatedCircle cx={CX} cy={CY} fill="url(#weight-bloom)" animatedProps={bloomProps} />

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

        <AnimatedCircle cx={CX} cy={CY} fill="url(#weight-core)" animatedProps={coreProps} />

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
          Stelar te leerá cuando registres.
        </Animated.Text>
        <Animated.Text style={[styles.anchorCopyDone, doneStyle]}>
          Stelar empieza desde aquí.
        </Animated.Text>
      </View>
    </View>
  )
}

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
  skipLink: {
    marginTop: 14,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    color: colors.magenta,
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
    paddingVertical: 8,
  },
  /* Cosmic anchor at the bottom of the screen. */
  anchor: {
    marginTop: 24,
    alignItems: 'center',
    gap: 6,
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
    fontSize: typography.sizes.body,
    color: colors.niebla,
    letterSpacing: 0.1,
  },
  anchorCopyDone: {
    position: 'absolute',
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.magenta,
    letterSpacing: 0.1,
  },
})
