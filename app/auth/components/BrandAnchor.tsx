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

import NorthStar from '@/assets/icons/north-star.svg'
import { colors, duration, typography } from '@/theme'

const ANCHOR_SIZE = 64
const HALO_SIZE = 132
const BREATH_MS = 3400

type BrandAnchorProps = {
  /** When true, the halo plays a single oro pulse instead of looping —
   *  used by the "revisa tu correo" moment. */
  pulseOnce?: boolean
  /** Whether to render the STELAR wordmark beneath the star. */
  showWordmark?: boolean
}

/*
 * The fixed point of the auth sky: the north-star glyph in oro, with a
 * halo that breathes (looping) or pulses once. Reduced-motion parks the
 * halo at a calm resting opacity. The star itself is tinted via
 * currentColor (oro); the embedded gradient gives it warmth, the halo
 * gives it the gold light.
 */
export function BrandAnchor({ pulseOnce = false, showWordmark = true }: BrandAnchorProps) {
  const breath = useSharedValue(0)
  const reduceMotion = useReducedMotion()

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

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + breath.value * 0.28,
    transform: [{ scale: 0.92 + breath.value * 0.16 }],
  }))

  return (
    <View style={styles.wrap}>
      <View style={styles.starWrap}>
        <Animated.View style={[styles.halo, haloStyle]} pointerEvents="none" />
        <NorthStar width={ANCHOR_SIZE} height={ANCHOR_SIZE} color={colors.oro} />
      </View>
      {showWordmark ? <Text style={styles.wordmark}>STELAR</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 12,
  },
  starWrap: {
    width: HALO_SIZE,
    height: HALO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    backgroundColor: colors.oroLight,
    // Soft radial glow approximated with a large blur-like shadow.
    shadowColor: colors.oro,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 40,
    shadowOpacity: 0.9,
  },
  wordmark: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: typography.letterSpacing.uppercaseMed,
  },
})
