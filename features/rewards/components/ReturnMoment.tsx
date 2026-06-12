import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { useReturnMoment } from '@/features/rewards/useReturnMoment'
import { colors, duration, easing, radius, spacing, typography } from '@/theme'

/*
 * Capa 1 — el momento de REGRESO. Una tarjeta dorada y breve al tope de
 * Hoy cuando vuelves tras 3+ días fuera: glifo ✦, frase en voz del coach
 * (serif italic), un pulso suave de glow y unas chispas que suben. Se
 * despide sola (~4.5 s) — recibe, no retiene. Sin botones, sin contar
 * días fuera, sin nada que se haya "perdido".
 *
 * Performance: el glow pulsa en la OPACITY de un wrapper View
 * (compositor-only, la lección de MacroRing) y las partículas son views
 * planas con transform/opacity en el UI thread — el <Svg> del glifo es
 * estático. Reduced motion: solo fade, sin pulso ni partículas.
 */

const DISMISS_MS = 4500

function ReturnSpark({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} fill={colors.oro} opacity={0.18} />
      <Path
        d="M12 3 L13.4 10.6 L21 12 L13.4 13.4 L12 21 L10.6 13.4 L3 12 L10.6 10.6 Z"
        fill={colors.oro}
      />
      <Circle cx={12} cy={12} r={2} fill={colors.oroLeche} />
    </Svg>
  )
}

export function ReturnMoment({ today }: { today: string }) {
  const { phrase, dismiss } = useReturnMoment(today)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (!phrase) return
    // Light success — el regreso se recibe, no se premia como un logro.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    const id = setTimeout(dismiss, DISMISS_MS)
    return () => clearTimeout(id)
  }, [phrase, dismiss])

  if (!phrase) return null
  return (
    <Animated.View
      entering={FadeIn.duration(reducedMotion ? 220 : duration.languid)}
      exiting={FadeOut.duration(duration.slow)}
      style={styles.wrap}
      accessible
      accessibilityRole="text"
      accessibilityLabel={phrase}
    >
      {!reducedMotion ? <GlowPulse /> : null}
      <View style={styles.row}>
        <ReturnSpark />
        <Text style={styles.phrase}>{phrase}</Text>
      </View>
      {!reducedMotion ? <SparkDrift /> : null}
    </Animated.View>
  )
}

/* ── Glow ──────────────────────────────────────────────────────────── */

// Un solo lavado dorado sobre la tarjeta: sube, respira y se apaga
// (~2 s, la duración del spec). Nunca se queda encendido.
function GlowPulse() {
  const glow = useSharedValue(0)

  useEffect(() => {
    glow.value = withSequence(
      withTiming(1, { duration: duration.languid, easing: easing.out }),
      withDelay(700, withTiming(0, { duration: duration.languid, easing: easing.out })),
    )
  }, [glow])

  const style = useAnimatedStyle(() => ({ opacity: glow.value }))

  return <Animated.View pointerEvents="none" style={[styles.glow, style]} />
}

/* ── Chispas ───────────────────────────────────────────────────────── */

// Tres puntos dorados que suben desde la tarjeta — "las estrellas
// reaparecen". Views planas, one-shot, sin loop.
const SPARKS = [
  { leftPct: 24, delay: 250, rise: 30 },
  { leftPct: 52, delay: 420, rise: 40 },
  { leftPct: 76, delay: 330, rise: 26 },
] as const

function SparkDrift() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {SPARKS.map((s) => (
        <Spark key={s.leftPct} leftPct={s.leftPct} delay={s.delay} rise={s.rise} />
      ))}
    </View>
  )
}

function Spark({ leftPct, delay, rise }: { leftPct: number; delay: number; rise: number }) {
  const t = useSharedValue(0)

  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 900, easing: easing.out }))
  }, [t, delay])

  const style = useAnimatedStyle(() => ({
    // `interpolate` ya es worklet — sin helpers JS dentro del closure.
    opacity: interpolate(t.value, [0, 0.2, 1], [0, 1, 0]),
    transform: [{ translateY: -rise * t.value }],
  }))

  return <Animated.View style={[styles.spark, { left: `${leftPct}%` }, style]} />
}

/* ── Styles ────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.s3,
    marginBottom: spacing.s2,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.card,
    backgroundColor: colors.oroTint,
    opacity: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    paddingVertical: spacing.s4,
    paddingHorizontal: spacing.s4,
  },
  phrase: {
    flex: 1,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  spark: {
    position: 'absolute',
    top: 6,
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.oroSoft,
  },
})
