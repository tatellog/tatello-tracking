import { useEffect, useMemo } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, G, Line } from 'react-native-svg'

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
function ShootingStar({ t, w, h }: { t: SharedValue<number>; w: number; h: number }) {
  const sx = -40
  const sy = h * 0.08
  const dx = w + 80
  const dy = h * 0.5
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

// Default viewport for back-compat — original OrbitalSystem usage.
// Screen-level usage passes its own width + height.
const DEFAULT_W = 372
// Extra vertical pad so the starfield extends a touch beyond the
// viewport bounds.
const FIELD_PAD = 48

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
  w,
  h,
}: {
  cloud: (typeof NEBULAE)[number]
  drift: SharedValue<number>
  w: number
  h: number
}) {
  const cx = cloud.fx * w
  const cy = cloud.fy * h
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
 * stable hash, so the sky never reshuffles between renders.
 *
 * Counts trimmed and opacity floors raised after the ornamental PNG
 * landed — the previous 58/30/13 distribution painted ~50 mid-bright
 * dots that read as visual noise/dust against the warm dark BG (cream
 * at low opacity over a dark warm field perceives as neutral grey,
 * not as star). Fewer, more confident stars now: 28/18/11. */
function buildStarfield(w: number, h: number, count: number): Star[] {
  // Star counts scale with the viewport's area so a fullscreen
  // cosmos has more stars than the diagram-sized one without
  // requiring the call site to pick a number. `count` is the
  // upper-bound the caller wants; we honour it directly.
  const TIER_RATIOS = [0.52, 0.32, 0.16] as const
  const tiers = [
    {
      n: Math.max(1, Math.round(count * TIER_RATIOS[0])),
      rMin: 0.4,
      rMax: 1.0,
      oMin: 0.18,
      oMax: 0.4,
    },
    {
      n: Math.max(1, Math.round(count * TIER_RATIOS[1])),
      rMin: 0.8,
      rMax: 1.4,
      oMin: 0.32,
      oMax: 0.6,
    },
    {
      n: Math.max(1, Math.round(count * TIER_RATIOS[2])),
      rMin: 1.5,
      rMax: 2.7,
      oMin: 0.5,
      oMax: 0.92,
    },
  ]
  const out: Star[] = []
  let i = 0
  tiers.forEach((tier, tIdx) => {
    for (let k = 0; k < tier.n; k++) {
      const h1 = Math.sin(i * 12.9898 + 4.1) * 43758.5453
      const h2 = Math.sin(i * 78.233 + 2.7) * 24634.6345
      const f = Math.abs(Math.sin(i * 51.17 + 9.1))
      out.push({
        x: (h1 - Math.floor(h1)) * w,
        y: -FIELD_PAD + (h2 - Math.floor(h2)) * (h + FIELD_PAD * 2),
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
            <Circle cx={s.x} cy={s.y} r={s.r * 3.2} fill="#F4ECDE" opacity={s.op * 0.18} />
          ) : null}
          <Circle cx={s.x} cy={s.y} r={s.r} fill="#F4ECDE" opacity={s.op} />
        </G>
      ))}
    </AnimatedG>
  )
}

export function Cosmos({
  t,
  drift,
  width = DEFAULT_W,
  height = DEFAULT_W,
  starCount = 57,
}: {
  t: SharedValue<number>
  drift: SharedValue<number>
  /** Viewport width in user-space units. Defaults to the legacy 372. */
  width?: number
  /** Viewport height in user-space units. Defaults to width (square). */
  height?: number
  /** Total star count budget across the three tiers. */
  starCount?: number
}) {
  const stars = useMemo(() => buildStarfield(width, height, starCount), [width, height, starCount])
  const buckets = useMemo(
    () => Array.from({ length: BUCKETS }, (_, b) => stars.filter((s) => s.bucket === b)),
    [stars],
  )
  return (
    <G>
      {NEBULAE.map((cloud, i) => (
        <NebulaCloud key={`neb-${i}`} cloud={cloud} drift={drift} w={width} h={height} />
      ))}
      {buckets.map((group, b) => (
        <StarBucket key={`bkt-${b}`} stars={group} index={b} t={t} />
      ))}
      <ShootingStar t={t} w={width} h={height} />
    </G>
  )
}

/*
 * Screen-level Cosmos — drops a full-bleed cosmic backdrop behind
 * everything in the Órbita tab so the diagram and the surrounding
 * content sit in the SAME cosmic space (no visible boundary between
 * "inside the diagram" and "outside"). Owns its own t + drift
 * clocks so the screen layer is independent of OrbitalSystem.
 */
export function ScreenCosmos({
  width,
  height,
  style,
}: {
  width: number
  height: number
  style?: StyleProp<ViewStyle>
}) {
  const t = useSharedValue(0)
  const drift = useSharedValue(0)
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    drift.value = withRepeat(withTiming(1, { duration: 44000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(t)
      cancelAnimation(drift)
    }
  }, [t, drift])
  // Scale star count with screen area — full-screen cosmos should
  // feel denser than the legacy diagram-bounded version.
  const starCount = Math.round(80 * (Math.min(width, height) / 393))
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Cosmos t={t} drift={drift} width={width} height={height} starCount={starCount} />
      </Svg>
    </View>
  )
}
