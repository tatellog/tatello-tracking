import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { Circle } from 'react-native-svg'

import { AnimatedG } from '../../animation/animated-components'

/* Today's star ring — thin cream orbital ring around the star
 * marked today. Slow rotation + breath so it doesn't compete with
 * the next-star pulse but unmistakably marks "this is THE one".
 *
 * REDUCED MOTION: rests VISIBLE and static — no rotation (deg = 0)
 * and opacity parked at the wave's high end (0.36) so it still
 * unmistakably marks "this is THE one", it simply stops orbiting.
 * `reduce` is a constant prop captured as a worklet closure scalar. */
export function TodayRing({
  cx,
  cy,
  r,
  t,
  reduce,
}: {
  cx: number
  cy: number
  r: number
  t: SharedValue<number>
  reduce: boolean
}) {
  const RING_R = r + 11
  const rotateProps = useAnimatedProps(() => {
    'worklet'
    const deg = reduce ? 0 : (t.value * (360 / 12)) % 360
    const wave = reduce ? 1 : 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI * 0.6)
    return {
      opacity: 0.18 + 0.18 * wave,
      transform: [
        { translateX: cx },
        { translateY: cy },
        { rotate: `${deg}deg` },
        { translateX: -cx },
        { translateY: -cy },
      ],
    }
  })
  return (
    <AnimatedG animatedProps={rotateProps}>
      <Circle
        cx={cx}
        cy={cy}
        r={RING_R}
        fill="none"
        stroke="#FFF6E5"
        strokeWidth={0.7}
        strokeDasharray="3 5"
      />
    </AnimatedG>
  )
}
