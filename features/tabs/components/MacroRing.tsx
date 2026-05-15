import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'

import { colors } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

type Props = {
  value: number
  target: number
  size?: number
  color?: string
  delay?: number
}

export function MacroRing({
  value,
  target,
  size = 72,
  color = colors.magenta,
  delay = 200,
}: Props) {
  const r = size / 2 - 6
  const c = 2 * Math.PI * r
  const pct = Math.min(1, target > 0 ? value / target : 0)
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(pct, { duration: 1400, easing: Easing.bezier(0.2, 0.7, 0.2, 1) }),
    )
  }, [progress, pct, delay])

  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: [c * progress.value, c],
  }))

  return (
    <View style={[styles.glow, { width: size, height: size, shadowColor: color }]}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        {/* Inner halo — three stacked low-alpha discs approximate a
            soft radial glow inside the ring. Reads as "this ring has
            life inside it" rather than just an arc on a void. */}
        <Circle cx={size / 2} cy={size / 2} r={Math.max(0, r - 2)} fill={color} opacity={0.04} />
        <Circle cx={size / 2} cy={size / 2} r={Math.max(0, r - 8)} fill={color} opacity={0.07} />
        <Circle cx={size / 2} cy={size / 2} r={Math.max(0, r - 16)} fill={color} opacity={0.12} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(244,236,222,0.10)"
          strokeWidth={3.5}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={3.5}
          strokeLinecap="round"
          animatedProps={animatedProps}
        />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  glow: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
})
