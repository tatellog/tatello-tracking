import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { Line } from 'react-native-svg'

import { AnimatedG } from '../../animation/animated-components'

/* Volumetric rays — 8 thin cream strokes radiating from the alpha,
 * rotating slowly. The Genshin signature for "this is a real cosmic
 * body" instead of a coloured dot. Reads the parked `t` under
 * reduce-motion → rests static (rays stay drawn, simply stop turning). */
export function VolumetricRays({
  cx,
  cy,
  r,
  t,
}: {
  cx: number
  cy: number
  r: number
  t: SharedValue<number>
}) {
  const rotateProps = useAnimatedProps(() => {
    'worklet'
    // 40 s per rotation (~5 cycles of t).
    const deg = (t.value * (360 / 5)) % 360
    return {
      transform: [
        { translateX: cx },
        { translateY: cy },
        { rotate: `${deg}deg` },
        { translateX: -cx },
        { translateY: -cy },
      ],
    }
  })
  const RAY_LEN = r * 6
  const RAY_INNER = r * 1.4
  return (
    <AnimatedG animatedProps={rotateProps}>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180
        const x1 = cx + Math.cos(rad) * RAY_INNER
        const y1 = cy + Math.sin(rad) * RAY_INNER
        const x2 = cx + Math.cos(rad) * RAY_LEN
        const y2 = cy + Math.sin(rad) * RAY_LEN
        // Cardinal rays (0/90/180/270) longer + slightly brighter.
        const isCardinal = deg % 90 === 0
        return (
          <Line
            key={`vr-${deg}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#FFF6E5"
            strokeOpacity={isCardinal ? 0.07 : 0.04}
            strokeWidth={isCardinal ? 0.6 : 0.4}
            strokeLinecap="round"
          />
        )
      })}
    </AnimatedG>
  )
}
