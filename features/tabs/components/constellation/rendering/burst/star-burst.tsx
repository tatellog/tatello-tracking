import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { G } from 'react-native-svg'

import { colors } from '@/theme'

import { AnimatedCircle } from '../../animation/animated-components'

import { ParticleBurst } from './particle-burst'

/* ─ Burst effect — round firework on each commit ───────────────────
 *
 * On every day-mark, a bright magenta core flashes at centre and
 * PARTICLE_COUNT sparks burst out as a round firework: the sparks are
 * spaced at even angles and all travel the same reach, so their heads
 * stay on one expanding circle. Each spark is a streak — the segment
 * between its position now and a beat earlier — radiating cleanly
 * outward, then flickering and fading. No gravity, no per-spark
 * jitter: the ring stays perfectly circular.
 *
 * Driven by the parent's `radialPulse` SharedValue 0→1.
 */

export function StarBurst({
  cx,
  cy,
  pulse,
  burstId,
  trainedCount,
}: {
  cx: number
  cy: number
  pulse: SharedValue<number>
  /** Increments once per commit — seeds the per-burst variability so
   *  no two fireworks render the same frame (a fixed burst
   *  habituates fast). */
  burstId: number
  /** Day count — drives the early-window (days 2–12) amplification
   *  that flattens the post-day-1 reward cliff. */
  trainedCount: number
}) {
  return (
    <G>
      <BurstCore cx={cx} cy={cy} pulse={pulse} />
      <ParticleBurst cx={cx} cy={cy} pulse={pulse} burstId={burstId} trainedCount={trainedCount} />
    </G>
  )
}

/* Bright magenta filled core. Pops in the first 25% of the pulse and
 * is gone by ~50%, so it reads as the ignition point that the three
 * stars expand outward from. Fill + scale, no stroke — this is the
 * "spark", not the "wave". */
function BurstCore({ cx, cy, pulse }: { cx: number; cy: number; pulse: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const u = pulse.value
    let op = 0
    if (u < 0.2) op = 0.95 * (u / 0.2)
    else if (u < 0.45) op = 0.95 * (1 - (u - 0.2) / 0.25)
    const r = 4 + u * 14
    return { r, opacity: op }
  })
  return (
    <AnimatedCircle cx={cx} cy={cy} r={4} fill={colors.magenta} animatedProps={animatedProps} />
  )
}
