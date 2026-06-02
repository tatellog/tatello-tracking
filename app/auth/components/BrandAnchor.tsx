import LottieView from 'lottie-react-native'
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'

import NorthStar from '@/assets/icons/north-star.svg'
import { colors, duration, typography } from '@/theme'

const ANCHOR_SIZE = 64
// The Lottie canvas is square; size it generously so the bloom + orbiting
// dust have room to breathe around the 64px star without clipping.
const GLOW_SIZE = 180
const BREATH_MS = 3400

type BrandAnchorProps = {
  /** When true, the star plays a single oro pulse instead of looping —
   *  used by the "revisa tu correo" moment. */
  pulseOnce?: boolean
  /** Whether to render the STELAR wordmark beneath the star. */
  showWordmark?: boolean
}

/*
 * The fixed point of the auth sky: the north-star glyph in oro over a REAL
 * celestial glow.
 *
 * The glow is a scoped Lottie (auth-hero-glow.json): layered radial-gradient
 * blooms that breathe + oro dust orbiting the star + staggered glints — the
 * same Genshin glow language as the cycle-ring-glow behind CycleRing. It
 * replaces the old flat oro disc (a filled View that read as an opaque
 * mauve puck — a solid fill is matter, not light). Lottie renders gradients
 * natively, sidestepping the iOS alpha-RadialGradient bug.
 *
 * Reduced motion suppresses the Lottie and falls back to a STATIC layered
 * radial glow (concentric SVG circles, the CycleRing trick — no unreliable
 * alpha gradient). The star itself breathes subtly (scale + opacity) on the
 * same clock so it reads as a live point of light, not a printed glyph.
 */
export function BrandAnchor({ pulseOnce = false, showWordmark = true }: BrandAnchorProps) {
  const breath = useSharedValue(0)
  const reduceMotion = useReducedMotion() ?? false

  useEffect(() => {
    if (reduceMotion) {
      breath.value = 0.5
      return
    }
    if (pulseOnce) {
      breath.value = withSequence(
        withTiming(1, { duration: duration.languid, easing: Easing.out(Easing.cubic) }),
        withTiming(0.35, { duration: BREATH_MS / 2, easing: Easing.inOut(Easing.sin) }),
      )
    } else {
      breath.value = withRepeat(
        withTiming(1, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      )
    }
    // Cleanup applies to BOTH animated branches — the pulseOnce sequence
    // can outlive the component (the reset screen swaps it out) and would
    // otherwise write to an unmounted shared value.
    return () => cancelAnimation(breath)
  }, [breath, pulseOnce, reduceMotion])

  // The star is alive: a small scale + opacity twinkle on the breath clock.
  // Numbers only — UI-thread safe.
  const starStyle = useAnimatedStyle(() => ({
    opacity: 0.86 + breath.value * 0.14,
    transform: [{ scale: 0.97 + breath.value * 0.04 }],
  }))

  return (
    <View style={styles.wrap}>
      <View style={styles.starWrap}>
        {reduceMotion ? (
          <StaticGlow />
        ) : (
          <View style={styles.glow} pointerEvents="none">
            <LottieView
              source={require('../../../assets/lottie/auth-hero-glow.json')}
              autoPlay
              loop
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
            />
          </View>
        )}
        <Animated.View style={starStyle} pointerEvents="none">
          <NorthStar width={ANCHOR_SIZE} height={ANCHOR_SIZE} color={colors.oro} />
        </Animated.View>
      </View>
      {showWordmark ? <Text style={styles.wordmark}>STELAR</Text> : null}
    </View>
  )
}

/* Reduced-motion fallback: a still oro glow built from concentric circles
 * of decreasing opacity (the CycleRing trick — avoids the iOS alpha
 * RadialGradient bug). Reads as a soft resting bloom, never a flat disc. */
function StaticGlow() {
  const c = GLOW_SIZE / 2
  return (
    <Svg width={GLOW_SIZE} height={GLOW_SIZE} style={styles.glow} pointerEvents="none">
      <Circle cx={c} cy={c} r={64} fill={colors.oro} opacity={0.05} />
      <Circle cx={c} cy={c} r={46} fill={colors.oroSoft} opacity={0.07} />
      <Circle cx={c} cy={c} r={30} fill={colors.oroLight} opacity={0.1} />
      <Circle cx={c} cy={c} r={16} fill={colors.oroLeche} opacity={0.16} />
    </Svg>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 12,
  },
  starWrap: {
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
  },
  wordmark: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: typography.letterSpacing.uppercaseMed,
  },
})
