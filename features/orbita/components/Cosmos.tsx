import { useMemo } from 'react'
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { Circle, G, Line } from 'react-native-svg'

/*
 * Cosmos — the deep field behind the orbital system. Drifting nebula
 * clouds plus a three-tier starfield (far / mid / near). The layers
 * move and twinkle at different rates: that parallax is what reads as
 * depth, so the planets feel like bodies IN space, not stickers on a
 * black void.
 */

const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedLine = Animated.createAnimatedComponent(Line)

/* A shooting star — a rare streak diagonally across the field. Active
 * only ~6% of a 24 s cycle, so it reads as an event, not a loop. */
function ShootingStar({ t }: { t: SharedValue<number> }) {
  const sx = -40
  const sy = 46
  const dx = W + 80
  const dy = W * 0.56
  const len = Math.hypot(dx, dy)
  const TAIL = 46

  const head = useAnimatedProps(() => {
    'worklet'
    const cycle = (t.value / 3) % 1
    if (cycle >= 0.06) return { opacity: 0, cx: -60, cy: -60 }
    const u = cycle / 0.06
    let op = 1
    if (u < 0.16) op = u / 0.16
    else if (u > 0.7) op = 1 - (u - 0.7) / 0.3
    return { opacity: op, cx: sx + dx * u, cy: sy + dy * u }
  })
  const tail = useAnimatedProps(() => {
    'worklet'
    const cycle = (t.value / 3) % 1
    if (cycle >= 0.06) return { opacity: 0, x1: -60, y1: -60, x2: -60, y2: -60 }
    const u = cycle / 0.06
    const hx = sx + dx * u
    const hy = sy + dy * u
    let op = 0.55
    if (u < 0.16) op = (u / 0.16) * 0.55
    else if (u > 0.7) op = (1 - (u - 0.7) / 0.3) * 0.55
    return {
      opacity: op,
      x1: hx - (dx / len) * TAIL,
      y1: hy - (dy / len) * TAIL,
      x2: hx,
      y2: hy,
    }
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
        animatedProps={tail}
      />
      <AnimatedCircle cx={0} cy={0} r={1.9} fill="#FFFFFF" animatedProps={head} />
    </G>
  )
}

// Must match OrbitalSystem's viewBox.
const W = 372

/* Nebula clouds — soft colour drifting behind everything. Each is a
 * stack of fading circles: a hand-built radial falloff, since an
 * alpha-stop RadialGradient misrenders on iOS in react-native-svg. */
const NEBULAE = [
  { fx: 0.28, fy: 0.32, r: 156, color: '#5A2A72', peak: 0.26, dx: 12, dy: 8, ph: 0 },
  { fx: 0.75, fy: 0.7, r: 172, color: '#942C56', peak: 0.26, dx: 14, dy: 10, ph: 0.34 },
  { fx: 0.68, fy: 0.22, r: 120, color: '#7E2C6C', peak: 0.18, dx: 9, dy: 13, ph: 0.62 },
  { fx: 0.32, fy: 0.76, r: 130, color: '#3A2A70', peak: 0.17, dx: 11, dy: 8, ph: 0.86 },
  { fx: 0.5, fy: 0.5, r: 104, color: '#A23E58', peak: 0.15, dx: 6, dy: 6, ph: 0.46 },
]
const CLOUD_STEPS = 8

function NebulaCloud({
  cloud,
  drift,
}: {
  cloud: (typeof NEBULAE)[number]
  drift: SharedValue<number>
}) {
  const cx = cloud.fx * W
  const cy = cloud.fy * W
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const a = (drift.value + cloud.ph) * 2 * Math.PI
    return {
      transform: [{ translateX: Math.cos(a) * cloud.dx }, { translateY: Math.sin(a) * cloud.dy }],
    }
  })
  return (
    <AnimatedG animatedProps={animatedProps}>
      {Array.from({ length: CLOUD_STEPS }).map((_, i) => (
        <Circle
          key={i}
          cx={cx}
          cy={cy}
          r={cloud.r * (1 - i / CLOUD_STEPS)}
          fill={cloud.color}
          opacity={cloud.peak / CLOUD_STEPS}
        />
      ))}
    </AnimatedG>
  )
}

/* ─ starfield ─ */
type Star = { x: number; y: number; r: number; op: number; halo: boolean; bucket: number }

const BUCKETS = 6

/* Three depth tiers: many tiny faint stars (far), through fewer big
 * bright ones (near). The variance IS the depth cue. Positions are a
 * stable hash, so the sky never reshuffles between renders. */
function buildStarfield(): Star[] {
  const tiers = [
    { n: 58, rMin: 0.3, rMax: 0.95, oMin: 0.07, oMax: 0.24 },
    { n: 30, rMin: 0.7, rMax: 1.35, oMin: 0.18, oMax: 0.42 },
    { n: 13, rMin: 1.5, rMax: 2.7, oMin: 0.4, oMax: 0.86 },
  ]
  const out: Star[] = []
  let i = 0
  tiers.forEach((tier, tIdx) => {
    for (let k = 0; k < tier.n; k++) {
      const h1 = Math.sin(i * 12.9898 + 4.1) * 43758.5453
      const h2 = Math.sin(i * 78.233 + 2.7) * 24634.6345
      const f = Math.abs(Math.sin(i * 51.17 + 9.1))
      out.push({
        x: (h1 - Math.floor(h1)) * W,
        y: (h2 - Math.floor(h2)) * W,
        r: tier.rMin + f * (tier.rMax - tier.rMin),
        op: tier.oMin + f * (tier.oMax - tier.oMin),
        halo: tIdx === 2 && f > 0.55,
        bucket: i % BUCKETS,
      })
      i++
    }
  })
  return out
}

/* A twinkle bucket — its stars share one slow opacity wobble, each
 * bucket on its own phase so the field scintillates asynchronously. */
function StarBucket({ stars, index, t }: { stars: Star[]; index: number; t: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value * 1.3 + index / BUCKETS) * 2 * Math.PI)
    return { opacity: 0.6 + 0.4 * wave }
  })
  return (
    <AnimatedG animatedProps={animatedProps}>
      {stars.map((s, i) => (
        <G key={i}>
          {s.halo ? (
            <Circle cx={s.x} cy={s.y} r={s.r * 3.2} fill="#F4ECDE" opacity={s.op * 0.16} />
          ) : null}
          <Circle cx={s.x} cy={s.y} r={s.r} fill="#FDF6E8" opacity={s.op} />
        </G>
      ))}
    </AnimatedG>
  )
}

export function Cosmos({ t, drift }: { t: SharedValue<number>; drift: SharedValue<number> }) {
  const stars = useMemo(buildStarfield, [])
  const buckets = useMemo(
    () => Array.from({ length: BUCKETS }, (_, b) => stars.filter((s) => s.bucket === b)),
    [stars],
  )
  return (
    <G>
      {NEBULAE.map((cloud, i) => (
        <NebulaCloud key={`neb-${i}`} cloud={cloud} drift={drift} />
      ))}
      {buckets.map((group, b) => (
        <StarBucket key={`bkt-${b}`} stars={group} index={b} t={t} />
      ))}
      <ShootingStar t={t} />
    </G>
  )
}
