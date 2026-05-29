import { memo } from 'react'
import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { G } from 'react-native-svg'

import { AnimatedCircle, AnimatedLine } from '../../animation/animated-components'
import { H, W } from '../../constants'

/* ─ Shooting star — ambient magic ──────────────────────────────────
 *
 * A small bright streak that crosses the canvas diagonally every ~10 s.
 * Active for only ~1.5 s per cycle (15% duty); the other 85% the
 * shooting star is fully transparent so the user perceives it as a
 * rare ambient event, not a recurring loop.
 *
 * Implementation: reuses the 8 s `t` clock at a slower modulo so we
 * don't spawn another timer. Position lerps from upper-left to lower-
 * right with a small head trail.
 */
export const ShootingStar = memo(function ShootingStar({
  t,
  cycleDiv = 1.6,
  phase = 0,
  startY = 40,
  endY = H * 0.55,
  active = 0.07,
}: {
  t: SharedValue<number>
  /** Slower divisor = rarer; faster = more frequent. */
  cycleDiv?: number
  /** 0..1 offset within the cycle so multiple shooting stars stagger. */
  phase?: number
  startY?: number
  endY?: number
  /** Fraction of the cycle the streak is visible. */
  active?: number
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const cycle = (t.value / cycleDiv + phase) % 1
    if (cycle >= active) return { opacity: 0, cx: -10, cy: -10 }
    const local = cycle / active
    const startX = -20
    const endX = W + 20
    const x = startX + (endX - startX) * local
    const y = startY + (endY - startY) * local
    let op = 1
    if (local < 0.15) op = local / 0.15
    else if (local > 0.7) op = 1 - (local - 0.7) / 0.3
    return { opacity: op, cx: x, cy: y }
  })

  const trailProps = useAnimatedProps(() => {
    'worklet'
    const cycle = (t.value / cycleDiv + phase) % 1
    if (cycle >= active) return { opacity: 0, x1: -10, y1: -10, x2: -10, y2: -10 }
    const local = cycle / active
    const startX = -20
    const endX = W + 20
    const x = startX + (endX - startX) * local
    const y = startY + (endY - startY) * local
    const tailLen = 26
    const dx = (endX - startX) / Math.hypot(endX - startX, endY - startY)
    const dy = (endY - startY) / Math.hypot(endX - startX, endY - startY)
    let op = 0.6
    if (local < 0.15) op = (local / 0.15) * 0.6
    else if (local > 0.7) op = (1 - (local - 0.7) / 0.3) * 0.6
    return { opacity: op, x1: x - dx * tailLen, y1: y - dy * tailLen, x2: x, y2: y }
  })

  return (
    <G>
      <AnimatedLine
        x1={0}
        y1={0}
        x2={0}
        y2={0}
        stroke="#FFFFFF"
        strokeWidth={1.4}
        strokeLinecap="round"
        animatedProps={trailProps}
      />
      <AnimatedCircle cx={0} cy={0} r={2.2} fill="#FFFFFF" animatedProps={animatedProps} />
    </G>
  )
})
