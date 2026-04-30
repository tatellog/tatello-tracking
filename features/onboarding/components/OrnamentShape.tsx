import { useEffect } from 'react'
import { StyleSheet, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, RadialGradient as SvgRadial, Stop } from 'react-native-svg'

import { colors } from '@/theme'

export type OrnamentVariant = 'tr' | 'bl' | 'tl-small' | 'br'

type Props = {
  variant: OrnamentVariant
  size?: number
}

const SIZE_BY_VARIANT: Record<OrnamentVariant, number> = {
  tr: 200,
  bl: 140,
  'tl-small': 160,
  br: 180,
}

/*
 * Decorative malva blob used as a subtle background accent on each
 * wizard step. Implemented with react-native-svg + RadialGradient
 * because RN's StyleSheet has no native radial-gradient — we need a
 * fade-to-transparent in the centre of the shape, not a solid disk.
 *
 * The pulse (scale + opacity) is a 4 s yoyo. It's slow enough to read
 * as ambience rather than animation; the user shouldn't ever feel
 * "something is moving on screen" while they're typing their name.
 */
export function OrnamentShape({ variant, size }: Props) {
  const dim = size ?? SIZE_BY_VARIANT[variant]
  const scale = useSharedValue(1)
  const opacity = useSharedValue(0.6)

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.1, { duration: 4000, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    )
    opacity.value = withRepeat(
      withTiming(0.4, { duration: 4000, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    )
  }, [scale, opacity])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.base, positionByVariant[variant], { width: dim, height: dim }, animStyle]}
    >
      <Svg width={dim} height={dim}>
        <Defs>
          <SvgRadial id={`ornament-${variant}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.mauveDeep} stopOpacity="0.13" />
            <Stop offset="70%" stopColor={colors.mauveDeep} stopOpacity="0" />
          </SvgRadial>
        </Defs>
        <Circle cx={dim / 2} cy={dim / 2} r={dim / 2} fill={`url(#ornament-${variant})`} />
      </Svg>
    </Animated.View>
  )
}

const positionByVariant: Record<OrnamentVariant, ViewStyle> = {
  tr: { position: 'absolute', top: -50, right: -60 },
  bl: { position: 'absolute', bottom: 100, left: -40 },
  'tl-small': { position: 'absolute', top: -40, left: -50 },
  br: { position: 'absolute', bottom: 80, right: -60 },
}

const styles = StyleSheet.create({
  base: {
    // Position fields are spread per-variant above. This base style is
    // here so we keep the borderRadius (in case a consumer wants to
    // crop the SVG to a perfect circle) and any shared properties in
    // one place.
    borderRadius: 999,
  },
})
