import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { G } from 'react-native-svg'

import { AnimatedCircle } from '../../animation/animated-components'
import { SPARK_BASE } from '../../constants'

/* StarParticles — cream sparks that drift upward from a lit star,
 * fading after ~3 s. Each star emits `emit` particles per cycle,
 * deterministically positioned by `seed` so adjacent stars don't
 * sync. */
export function StarParticles({
  cx,
  cy,
  r,
  t,
  seed,
  emit,
}: {
  cx: number
  cy: number
  r: number
  t: SharedValue<number>
  seed: number
  emit: number
}) {
  // Generate SPARK_BASE * emit sparks. Each has its own phase + lateral
  // jitter so they don't overlap.
  return (
    <G>
      {Array.from({ length: SPARK_BASE * emit }).map((_, i) => {
        const phase = ((seed * 17 + i * 23) % 100) / 100
        const lateral = (((seed * 31 + i * 13) % 100) / 100 - 0.5) * r * 2.6
        return (
          <StarSpark key={`sp-${i}`} cx={cx} cy={cy} r={r} t={t} phase={phase} lateral={lateral} />
        )
      })}
    </G>
  )
}

/* A single rising spark — owned by StarParticles. Kept in the same
 * file because the two are tightly coupled (StarParticles is the
 * loop, StarSpark is the per-particle render); separating them adds
 * import churn without easing comprehension. */
function StarSpark({
  cx,
  cy,
  r,
  t,
  phase,
  lateral,
}: {
  cx: number
  cy: number
  r: number
  t: SharedValue<number>
  phase: number
  lateral: number
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const u = (t.value * 0.35 + phase) % 1
    // Rise from cy to cy - 14 over the cycle.
    const dy = -u * 14
    // Slight lateral sway in addition to base offset.
    const dx = lateral + Math.sin(u * Math.PI * 2) * 1.2
    // Fade in 0..0.15, hold middle, fade out 0.7..1.
    let op = 0.7
    if (u < 0.15) op = (u / 0.15) * 0.7
    else if (u > 0.7) op = (1 - (u - 0.7) / 0.3) * 0.7
    return { cx: cx + dx, cy: cy + dy, opacity: op }
  })
  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={Math.max(0.4, r * 0.12)}
      fill="#FFF6E5"
      animatedProps={animatedProps}
    />
  )
}
