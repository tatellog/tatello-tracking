import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
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
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg'

import { StepHeader, WizardLayout } from '@/features/onboarding/components'
import { type MonthlyFocus } from '@/features/profile/api'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedLine = Animated.createAnimatedComponent(Line)

/** A single intention option with a short, low-key descriptor. The
 *  descriptor sits below the label so each card carries actual
 *  weight — not a flat one-word chip. */
type IntentOption = {
  value: MonthlyFocus
  label: string
  tagline: string
}

// Ordered outcome → pattern → other. Outcome buckets ("Bajar de peso",
// "Tener más energía") come first because most users arrive with an
// outcome goal. Pattern-detection options ("Entender mis patrones",
// "Conocer mi ciclo") name what Stelar actually does best; "Calmar
// la mente" sits at the end as the more emotional bucket.
const FOCUS_OPTIONS: readonly IntentOption[] = [
  { value: 'weight', label: 'Bajar de peso', tagline: 'El cuerpo va a moverse' },
  { value: 'energy', label: 'Tener más energía', tagline: 'Saber de dónde sale tu fuerza' },
  { value: 'sleep', label: 'Dormir profundo', tagline: 'La noche se vuelve descanso' },
  { value: 'food', label: 'Comer con menos lucha', tagline: 'Que comer deje de pesar' },
  { value: 'cycle', label: 'Conocer mi ciclo', tagline: 'Tu cuerpo va a hablarte' },
  { value: 'patterns', label: 'Entender mis patrones', tagline: 'Stelar mapea lo que se repite' },
  { value: 'mind', label: 'Calmar la mente', tagline: 'Menos ruido por dentro' },
  { value: 'other', label: 'Otra cosa', tagline: 'La nombras tú' },
]

/** Phrase Stelar quietly utters after the user picks an intention.
 *  Lower-stakes than the reveal — it's the operant-conditioning
 *  "yes, I heard you" beat that locks in the choice. */
const FOCUS_CELEBRATION: Record<MonthlyFocus, string> = {
  weight: 'Stelar va a leerte con eso en mente.',
  energy: 'Stelar va a buscar de dónde sale tu energía.',
  sleep: 'Stelar te acompaña a tu sueño más profundo.',
  food: 'Stelar afina lo que ves cuando comes.',
  cycle: 'Stelar pone el ciclo en primer plano.',
  patterns: 'Stelar se enfoca en qué se repite en ti.',
  mind: 'Stelar afina la lectura hacia tu mente.',
  other: 'Stelar lo guarda y se ajusta a ti.',
}

/*
 * Step 9 — Tu intención. Single-select of the dimension Stelar will
 * weight first. The earlier wrap-chip version of this screen felt
 * generic (8 identical pills floating with massive empty space
 * below). This version uses a vertical list of premium cards: each
 * option has a label + one-line tagline, the selected card gets a
 * dramatic magenta glow + scale-up, and the non-selected cards
 * quietly dim so the chosen one is the only thing the eye lands on.
 *
 * Persisted to profile.monthly_focus. After Continuar fires, a brief
 * microcelebration overlay confirms Stelar received it.
 */
export default function TuIntencionScreen() {
  const router = useRouter()
  // Opened from Ajustes (?source=settings) → save and pop back to
  // Settings; otherwise this is the onboarding wizard → advance to
  // notificaciones after the microcelebration.
  const { source } = useLocalSearchParams<{ source?: string }>()
  const fromSettings = source === 'settings'
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()

  const [focus, setFocus] = useState<MonthlyFocus | null>(
    (profile?.monthly_focus as MonthlyFocus | null) ?? null,
  )

  const firstName = (profile?.display_name ?? '').trim().split(' ')[0] || ''
  const eyebrow = firstName ? `Tu intención · ${firstName}` : 'Tu intención'

  const canContinue = focus !== null
  const [celebrating, setCelebrating] = useState(false)

  // Slow shared breath drives the resting state of every card's
  // presence dot so the column reads as alive, not frozen.
  const clock = useSharedValue(0)
  useEffect(() => {
    clock.value = withRepeat(
      withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    return () => cancelAnimation(clock)
  }, [clock])

  const handlePick = (next: MonthlyFocus) => {
    Haptics.selectionAsync().catch(() => {})
    setFocus(next)
  }

  const handleContinue = () => {
    if (!canContinue || !focus) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    setCelebrating(true)
    updateProfile.mutate(
      { monthly_focus: focus },
      {
        onSuccess: () => {
          setTimeout(() => {
            if (fromSettings) router.back()
            else router.push('/onboarding/notificaciones')
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
            question="¿Qué te trajo a Stelar?"
            questionEmphasis="trajo"
            hint="Una sola elección. Puedes cambiarla."
          />

          <View style={styles.list}>
            {FOCUS_OPTIONS.map((opt) => {
              const selected = focus === opt.value
              const isAnySelected = focus !== null
              return (
                <IntentCard
                  key={opt.value}
                  option={opt}
                  selected={selected}
                  dim={isAnySelected && !selected}
                  onPress={() => handlePick(opt.value)}
                  clock={clock}
                />
              )
            })}
          </View>
        </ScrollView>
      </WizardLayout>

      {/* Microcelebration — full-screen overlay (outside WizardLayout
          so it covers the safe area + CTA too).
          Choreographed beats over 1.1 s:
            t=0    veil fades in + body starts bloom
            t=300  fireworks burst outward + body fully bloomed
            t=500  text fades in
            t=1100 navigation fires (exit fade-out kicks in)
          The body keeps a slow breath through the whole moment so it
          doesn't feel frozen while the text reads. */}
      {celebrating && focus ? (
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(280)}
          pointerEvents="none"
          style={styles.celebOverlay}
        >
          <View style={styles.celebInner}>
            <CelebrationBody />
            <Animated.Text entering={FadeIn.duration(380).delay(500)} style={styles.celebText}>
              {FOCUS_CELEBRATION[focus]}
            </Animated.Text>
          </View>
        </Animated.View>
      ) : null}
    </>
  )
}

/* ─────────────────────── Card ─────────────────────── */

/** One intention card. Idle = quiet bgCard with a dim presence dot.
 *  Selected = magenta border + tint + glow + dot ignites + slight
 *  scale-up. When another card is selected, this one fades to a dim
 *  state so the user's eye stays on the chosen one. */
function IntentCard({
  option,
  selected,
  dim,
  onPress,
  clock,
}: {
  option: IntentOption
  selected: boolean
  dim: boolean
  onPress: () => void
  clock: SharedValue<number>
}) {
  const scale = useSharedValue(1)
  useEffect(() => {
    scale.value = withSpring(selected ? 1.02 : 1, { damping: 16, stiffness: 220 })
  }, [selected, scale])

  // Card-level transform animates scale.
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  // Label slides 4 px to the right when claimed.
  const textStyle = useAnimatedStyle(() => {
    'worklet'
    return { transform: [{ translateX: selected ? 4 : 0 }] }
  })

  // Idle dots breathe; selected dots ignite + grow.
  const dotStyle = useAnimatedStyle(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    const s = selected ? 1.25 : 1
    return {
      transform: [{ scale: s * (1 + b * 0.08) }],
      opacity: selected ? 1 : dim ? 0.18 : 0.42 + b * 0.12,
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
        <View style={[styles.card, selected ? styles.cardOn : styles.cardOff]}>
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

/* ─────────────────────── CelebrationBody ─────────────────────── */

/** A small cosmic body that blooms in, then bursts a ring of
 *  fireworks outward. Same vocabulary as the reveal screen's
 *  satellites (RadialGradient bloom + diagonal twinkle + core with
 *  white-hot gradient) plus 16 magenta-cream sparks shooting out
 *  from the centre and fading at the rim — the "fuegos artificiales"
 *  that punctuate the user's declared intention. */
const CELEB_W = 220
const CELEB_H = 200
const CELEB_CX = CELEB_W / 2
const CELEB_CY = CELEB_H / 2

/** Deterministic ring of 16 firework sparks. Angles are jittered off
 *  the 16-point compass so the burst doesn't read as a wheel; sizes
 *  + distances vary so the explosion has texture. */
type Spark = {
  angle: number
  distance: number
  size: number
  /** 0..1 fraction of MAX_DELAY — staggers the burst slightly. */
  delayFraction: number
  /** Cream or white — cream dominates, white sparks pepper. */
  fill: string
}
const SPARK_DURATION = 720
const SPARK_MAX_DELAY = 220
const SPARKS: readonly Spark[] = (() => {
  const out: Spark[] = []
  const rand = (i: number) => {
    const v = Math.sin(i * 9301 + 49297) * 233280
    return v - Math.floor(v)
  }
  for (let i = 0; i < 16; i++) {
    const baseAngle = (i / 16) * 2 * Math.PI
    out.push({
      angle: baseAngle + (rand(i + 1) - 0.5) * 0.35,
      distance: 56 + rand(i + 50) * 38,
      size: 1.2 + rand(i + 100) * 1.1,
      delayFraction: rand(i + 150),
      fill: rand(i + 200) > 0.7 ? '#FFFFFF' : '#FBD7E3',
    })
  }
  return out
})()

function CelebrationBody() {
  // Slow breath keeps the body alive during the whole 1.1 s moment.
  const breath = useSharedValue(0)
  // Bloom value rises 0 → 1 in the first 320 ms (the body grows in).
  const bloom = useSharedValue(0)
  // Fireworks clock — fires 300 ms after mount, spans 940 ms total
  // (SPARK_DURATION + SPARK_MAX_DELAY) so sparks reach their rim.
  const sparks = useSharedValue(0)

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
    const sparksTimer = setTimeout(() => {
      sparks.value = withTiming(1, {
        duration: SPARK_DURATION + SPARK_MAX_DELAY,
        easing: Easing.out(Easing.cubic),
      })
    }, 300)
    return () => {
      cancelAnimation(breath)
      cancelAnimation(bloom)
      cancelAnimation(sparks)
      clearTimeout(sparksTimer)
    }
  }, [breath, bloom, sparks])

  // Bloom layers — single RadialGradient circle whose radius +
  // overall opacity ride bloom (entrance) + breath (ongoing).
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
  const diagonalSpikes = useAnimatedProps(() => {
    'worklet'
    return { opacity: bloom.value * 0.55 }
  })
  const raysProps = useAnimatedProps(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(breath.value * 2 * Math.PI)
    return { opacity: bloom.value * (0.5 + b * 0.08) }
  })

  // 8 radial rays at jittered angles — organic starburst (same as
  // the cuerpo-base + weight cosmic anchors).
  const RAYS = [
    { angle: -1.5, length: 26 },
    { angle: -0.65, length: 20 },
    { angle: 0.2, length: 28 },
    { angle: 0.95, length: 22 },
    { angle: 1.6, length: 18 },
    { angle: 2.4, length: 27 },
    { angle: 3.1, length: 24 },
    { angle: -2.55, length: 21 },
  ]

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

      {/* Atmospheric bloom — RadialGradient-filled circle, no ring
          edges. Radius pulses with breath. */}
      <AnimatedCircle
        cx={CELEB_CX}
        cy={CELEB_CY}
        fill="url(#celeb-bloom)"
        animatedProps={bloomProps}
      />

      {/* 16 firework sparks — burst outward from centre once the
          sparks clock fires. */}
      {SPARKS.map((spark, i) => (
        <FireworkSpark key={`spark-${i}`} spark={spark} clock={sparks} />
      ))}

      {/* 8 organic radial rays. */}
      <AnimatedG animatedProps={raysProps} rays={RAYS} />

      {/* 2 diagonal spikes (no cardinal cross — no crosshair). */}
      <AnimatedLine
        x1={CELEB_CX - 13}
        y1={CELEB_CY - 13}
        x2={CELEB_CX + 13}
        y2={CELEB_CY + 13}
        stroke="#FFFFFF"
        strokeWidth={0.7}
        strokeLinecap="round"
        animatedProps={diagonalSpikes}
      />
      <AnimatedLine
        x1={CELEB_CX + 13}
        y1={CELEB_CY - 13}
        x2={CELEB_CX - 13}
        y2={CELEB_CY + 13}
        stroke="#FFFFFF"
        strokeWidth={0.7}
        strokeLinecap="round"
        animatedProps={diagonalSpikes}
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

/** A small wrapper that renders the 8 radial rays with one shared
 *  animated opacity (so they all twinkle together with the breath +
 *  bloom). */
function AnimatedG({
  animatedProps,
  rays,
}: {
  animatedProps: ReturnType<typeof useAnimatedProps>
  rays: { angle: number; length: number }[]
}) {
  return (
    <>
      {rays.map((ray, i) => (
        <AnimatedLine
          key={`ray-${i}`}
          x1={CELEB_CX}
          y1={CELEB_CY}
          x2={CELEB_CX + Math.cos(ray.angle) * ray.length}
          y2={CELEB_CY + Math.sin(ray.angle) * ray.length}
          stroke="#FBD7E3"
          strokeWidth={0.6}
          strokeLinecap="round"
          animatedProps={animatedProps}
        />
      ))}
    </>
  )
}

/** One firework spark. Travels from the centre to its rim distance
 *  with a fade-in-fast / fade-out-slow envelope, so the burst feels
 *  organic instead of linear. */
function FireworkSpark({ spark, clock }: { spark: Spark; clock: SharedValue<number> }) {
  const props = useAnimatedProps(() => {
    'worklet'
    const totalDuration = SPARK_DURATION + SPARK_MAX_DELAY
    const startFraction = (spark.delayFraction * SPARK_MAX_DELAY) / totalDuration
    const endFraction = (spark.delayFraction * SPARK_MAX_DELAY + SPARK_DURATION) / totalDuration
    const t = clock.value
    const localPhase =
      t < startFraction
        ? 0
        : t > endFraction
          ? 1
          : (t - startFraction) / (endFraction - startFraction)
    const r = spark.distance * localPhase
    // Opacity envelope: fast fade-in (0..0.08), brief peak, slow fade.
    let opacity = 0
    if (localPhase < 0.08) opacity = localPhase * 12
    else if (localPhase < 0.25) opacity = 1
    else opacity = Math.max(0, 1 - (localPhase - 0.25) / 0.75)
    return {
      cx: CELEB_CX + Math.cos(spark.angle) * r,
      cy: CELEB_CY + Math.sin(spark.angle) * r,
      r: spark.size * (1 - localPhase * 0.45),
      opacity,
    }
  })
  return <AnimatedCircle animatedProps={props} fill={spark.fill} />
}

/* ─────────────────────── Styles ─────────────────────── */

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  list: {
    marginTop: 24,
    // Inset horizontally so the selected card's magenta shadow has
    // room to project without being clipped by the ScrollView.
    paddingHorizontal: 14,
  },
  cardOuter: {
    marginBottom: 10,
  },
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
  },
  cardOff: {
    backgroundColor: colors.bgCard,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardOn: {
    backgroundColor: 'rgba(217, 39, 102, 0.12)',
    borderColor: colors.magenta,
    shadowColor: colors.magenta,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
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
    fontSize: 17,
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
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.3,
    color: colors.niebla,
  },
  taglineOn: {
    color: '#F4ABC8',
  },
  /* Microcelebration overlay — same as before. */
  celebOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    backgroundColor: 'rgba(20, 4, 12, 0.92)',
  },
  celebInner: {
    alignItems: 'center',
    gap: 22,
  },
  celebText: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 24,
    lineHeight: 32,
    color: colors.leche,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
})
