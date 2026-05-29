import { useMemo } from 'react'
import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { G } from 'react-native-svg'

import { AnimatedLine } from '../../animation/animated-components'
import type { Resolved } from '../../types'

/* ─ Igniting line ──────────────────────────────────────────────────
 *
 * SVG stroke-trace via animated strokeDashoffset. Two layered
 * strokes: a wide warm-gold bloom underneath and a bright
 * white-cream spine on top, so the path reads as a luminous
 * brushstroke being painted across the sky.
 */

export function IgnitingLine({
  A,
  B,
  igniteT,
}: {
  A: Resolved
  B: Resolved
  igniteT: SharedValue<number>
}) {
  const length = useMemo(() => Math.hypot(B.x - A.x, B.y - A.y), [A, B])

  // strokeDasharray = full length; strokeDashoffset drops from L to 0
  // so the visible segment slides into view, drawing the line A→B
  // over the animation. Two layered strokes: a wide warm-gold bloom
  // underneath and a bright white-cream spine on top, so the path
  // reads as a luminous brushstroke being painted across the sky.
  const drawProps = useAnimatedProps(() => {
    'worklet'
    return { strokeDashoffset: length * (1 - igniteT.value) }
  })
  // Bright head — concentrated at the leading edge of the draw so
  // the eye sees a comet-like tip painting the line on.
  const headProps = useAnimatedProps(() => {
    'worklet'
    const u = igniteT.value
    return {
      strokeDashoffset: length * (1 - u),
      opacity: u < 0.85 ? 1 : 1 - (u - 0.85) / 0.15,
    }
  })

  return (
    <G>
      <AnimatedLine
        x1={A.x}
        y1={A.y}
        x2={B.x}
        y2={B.y}
        stroke="#D9AE6F"
        strokeOpacity={0.7}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={`${length} ${length}`}
        animatedProps={drawProps}
      />
      <AnimatedLine
        x1={A.x}
        y1={A.y}
        x2={B.x}
        y2={B.y}
        stroke="#FFFFFF"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeDasharray={`6 ${length}`}
        animatedProps={headProps}
      />
    </G>
  )
}
