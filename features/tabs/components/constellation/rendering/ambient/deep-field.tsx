import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { Circle } from 'react-native-svg'

import { AnimatedG } from '../../animation/animated-components'
import { DEEP_STARS } from '../../data/scatter'

export function DeepField({ drift }: { drift: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const a = drift.value * 2 * Math.PI * 0.15
    return {
      transform: [{ translateX: Math.sin(a) * 4 }, { translateY: Math.cos(a) * 3 }],
    }
  })
  return (
    <AnimatedG animatedProps={animatedProps}>
      {DEEP_STARS.map((s, i) => (
        <Circle key={`d-${i}`} cx={s.x} cy={s.y} r={s.r} fill="#F4ECDE" opacity={s.op} />
      ))}
    </AnimatedG>
  )
}
