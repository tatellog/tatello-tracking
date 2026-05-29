import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { G } from 'react-native-svg'

import { AnimatedCircle } from '../../animation/animated-components'

/* ─ Completion rings ───────────────────────────────────────────────
 *
 * Two faint magenta rings expanding outward from centre on the 8 s
 * system clock, layered antipodally so one is always near peak.
 * Rendered only once the user reaches day 28 — confirms "you finished
 * the cycle" without dominating the constellation that earned it.
 */

export function CompletionRings({ cx, cy, t }: { cx: number; cy: number; t: SharedValue<number> }) {
  const innerProps = useAnimatedProps(() => {
    'worklet'
    // 5s loop derived from the 8s base.
    const p = (t.value * (8 / 5)) % 1
    return { r: 110 + p * 20, opacity: 0.35 * (1 - p) }
  })
  const outerProps = useAnimatedProps(() => {
    'worklet'
    const p = (t.value * (8 / 5) + 0.32) % 1
    return { r: 130 + p * 20, opacity: 0.2 * (1 - p) }
  })
  return (
    <G>
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={110}
        fill="none"
        stroke="rgba(233,30,99,0.35)"
        strokeWidth={0.5}
        animatedProps={innerProps}
      />
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={130}
        fill="none"
        stroke="rgba(233,30,99,0.20)"
        strokeWidth={0.5}
        animatedProps={outerProps}
      />
    </G>
  )
}
