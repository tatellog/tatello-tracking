import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

import { colors } from '@/theme'

/**
 * Manifiesto decorative orb. Three concentric layers anchored
 * bottom-right of the screen:
 *
 *   - core: radial gradient magenta → transparent, scale + opacity
 *     yoyo (Reanimated translation of the CSS `breathe` keyframe).
 *   - ring: 1 px alpha-magenta circle, runs the yoyo in reverse so
 *     it contra-pulses.
 *   - satellite: 6 px solid magenta dot orbiting at 28 px radius.
 */
export function ManifiestoOrb() {
  const breath = useSharedValue(0)
  const counterBreath = useSharedValue(1)
  const drift = useSharedValue(0)

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 5500, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    )
    counterBreath.value = withRepeat(
      withTiming(0, { duration: 5500, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    )
    drift.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1, false)

    return () => {
      cancelAnimation(breath)
      cancelAnimation(counterBreath)
      cancelAnimation(drift)
    }
  }, [breath, counterBreath, drift])

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.06 }],
    opacity: 0.55 + breath.value * 0.4,
  }))
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + counterBreath.value * 0.06 }],
    opacity: 0.55 + counterBreath.value * 0.4,
  }))
  const satStyle = useAnimatedStyle(() => {
    const angle = drift.value * 2 * Math.PI
    return {
      transform: [{ translateX: Math.cos(angle) * 28 }, { translateY: Math.sin(angle) * 28 }],
    }
  })

  return (
    <View style={styles.wrap} pointerEvents="none" aria-hidden>
      <Animated.View style={[styles.core, coreStyle]}>
        <Svg width={180} height={180}>
          <Defs>
            <RadialGradient id="manif-core" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FF4886" stopOpacity={0.45} />
              <Stop offset="30%" stopColor={colors.magenta} stopOpacity={0.25} />
              <Stop offset="70%" stopColor={colors.magenta} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={90} cy={90} r={90} fill="url(#manif-core)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.ring, ringStyle]} />
      <Animated.View style={[styles.satellite, satStyle]} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: -40,
    bottom: 60,
    width: 180,
    height: 180,
  },
  core: {
    position: 'absolute',
    width: 180,
    height: 180,
  },
  ring: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: 'rgba(233, 30, 99, 0.18)',
  },
  satellite: {
    position: 'absolute',
    top: 87,
    left: 87,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.magenta,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 5,
  },
})
