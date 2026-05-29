import { useState } from 'react'
import {
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  type SharedValue,
} from 'react-native-reanimated'
import { G } from 'react-native-svg'

import { colors } from '@/theme'

import { AnimatedLine } from '../../animation/animated-components'
import { PARTICLE_BASE, PARTICLE_REACH } from '../../constants'
import { SPARK_HUES } from '../../data/scatter'
import { burstHash } from '../../geometry'

/* ─ Particle burst ─────────────────────────────────────────────────
 *
 * The radial firework: PARTICLE_COUNT sparks shoot outward as a round
 * ring on every commit. Spacing is even (+ tiny jitter) so the ring
 * stays circular but breathes. Every 5th burst is "big"; days 2–12
 * carry an early-window amplification that flattens the post-day-1
 * reward cliff.
 */

export function ParticleBurst({
  cx,
  cy,
  pulse,
  trainedCount,
}: {
  cx: number
  cy: number
  pulse: SharedValue<number>
  trainedCount: number
}) {
  // Gate the render on pulse mid-flight + own a local burstId counter
  // (bumped on every burst start). Two reasons it lives here instead of
  // in useIgnitionEngine:
  //   1. setBurstId there forced a re-render of the entire orchestrator
  //      (and its ~150-component subtree) every commit. Owning it locally
  //      keeps the bump scoped to this subtree.
  //   2. Without the active gate, ~28 ParticleSpark worklets evaluated
  //      every frame even with pulse=0 (~1.6k zombie ops/sec). The
  //      reaction flips React state at the burst boundaries so the SVG
  //      nodes unmount when there's nothing to show.
  const [active, setActive] = useState(false)
  const [burstId, setBurstId] = useState(0)
  useAnimatedReaction(
    () => pulse.value > 0 && pulse.value < 1,
    (isActive, prev) => {
      if (isActive === prev) return
      runOnJS(setActive)(isActive)
      if (isActive) runOnJS(setBurstId)((n) => n + 1)
    },
    [],
  )
  if (!active) return null

  // Every 5th commit is an amplified "bigger moment" — a cadence the
  // user can't quite predict, which keeps the reward-prediction error
  // (and so the dopamine) alive.
  const big = burstId > 0 && burstId % 5 === 0
  // Early-window boost — days 2–12 get extra sparks, decaying from
  // ~1.4× on day 2 to 1.0× by day 12. Flattens the cliff after the
  // big day-1 celebration: the fragile habit-forming window gets
  // *more* reward, not a sudden drop to baseline.
  const earlyBoost =
    trainedCount >= 2 && trainedCount <= 12 ? 1 + 0.4 * ((12 - trainedCount) / 10) : 1
  const base = big ? 46 : PARTICLE_BASE + Math.floor(burstHash(burstId, 1) * 9) - 4
  const count = Math.min(54, Math.round(base * earlyBoost))
  return (
    <G>
      {Array.from({ length: count }).map((_, i) => (
        <ParticleSpark
          key={i}
          cx={cx}
          cy={cy}
          index={i}
          count={count}
          burstId={burstId}
          big={big}
          pulse={pulse}
        />
      ))}
    </G>
  )
}

/* One firework spark. Shoots straight out along its radial angle
 * (ease-out — explosive launch, then air drag), flickers, fades.
 * Rendered as the streak between the head (position now) and the tail
 * (position a beat earlier). Angle, reach and hue carry a small
 * per-commit jitter so the ring is organic, never a stamped circle. */
function ParticleSpark({
  cx,
  cy,
  index,
  count,
  burstId,
  big,
  pulse,
}: {
  cx: number
  cy: number
  index: number
  count: number
  burstId: number
  big: boolean
  pulse: SharedValue<number>
}) {
  // Even spacing + a small per-spark angular jitter — the ring breathes.
  const jitter = (burstHash(burstId, index) - 0.5) * 0.16
  const angle = (index / count) * Math.PI * 2 + jitter
  // A handful of sparks fly noticeably further — a different
  // silhouette every commit.
  const isLong = burstHash(burstId, index * 3 + 5) > 0.86
  const reachMul =
    (0.85 + burstHash(burstId, index + 40) * 0.3) * (isLong ? 1.5 : 1) * (big ? 1.22 : 1)
  const reach = PARTICLE_REACH * reachMul
  const color =
    SPARK_HUES[Math.floor(burstHash(burstId, index + 7) * SPARK_HUES.length)] ?? colors.magenta
  const width = 2 + Math.abs(Math.sin(index * 17.3)) * 0.8
  const dirX = Math.cos(angle)
  const dirY = Math.sin(angle)
  const flickPhase = (index * 0.37) % 1

  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const u = pulse.value
    if (u <= 0 || u >= 1) {
      return { x1: -20, y1: -20, x2: -20, y2: -20, opacity: 0 }
    }
    // ease-out radial travel for the head; the tail trails a beat
    // behind.
    const lag = 0.08
    const uTail = u < lag ? 0 : u - lag
    const tHead = 1 - (1 - u) * (1 - u)
    const tTail = 1 - (1 - uTail) * (1 - uTail)
    const xHead = cx + dirX * reach * tHead
    const yHead = cy + dirY * reach * tHead
    const xTail = cx + dirX * reach * tTail
    const yTail = cy + dirY * reach * tTail
    // fast fade-in, long fade-out, plus a fast flicker.
    const fade = u < 0.06 ? u / 0.06 : 1 - (u - 0.06) / 0.94
    const flicker = 0.7 + 0.3 * Math.sin(u * 70 + flickPhase * 6.283)
    return { x1: xTail, y1: yTail, x2: xHead, y2: yHead, opacity: fade * flicker }
  })

  return (
    <AnimatedLine
      x1={cx}
      y1={cy}
      x2={cx}
      y2={cy}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      animatedProps={animatedProps}
    />
  )
}
