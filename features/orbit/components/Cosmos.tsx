import { useEffect, useMemo } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, G, Line } from 'react-native-svg'
// Skia owns the nebula layer now — real Gaussian blur + FractalNoise
// gives the filamentary texture a stack of SVG circles never could.
// Aliased where the name collides with react-native-svg (Circle).
import {
  BlurMask,
  Canvas,
  Circle as SkiaCircle,
  FractalNoise,
  Group as SkiaGroup,
  Mask,
  RadialGradient as SkiaRadialGradient,
  Rect as SkiaRect,
  vec,
} from '@shopify/react-native-skia'

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

/* "#RRGGBB" + alpha → "rgba(r,g,b,a)" for Skia colour stops. Pure. */
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/* Nebula clouds — soft colour drawn in Skia as ROTATED ELLIPSES (not
 * circles) over TWO depth planes, which is what gives the field its
 * sense of volume:
 *   • FAR plane (`depth: 'far'`) — large, very faint, heavily blurred
 *     diagonal washes that drift barely at all. They read as the distant
 *     galactic haze the nearer clouds float in front of.
 *   • NEAR plane (`depth: 'near'`) — the framing clouds in the outer
 *     quadrants, brighter, more textured, drifting more (parallax = the
 *     near layer moving faster than the far layer is the depth cue).
 * The centre stays clear of NEAR clouds so the galaxy + protagonist star
 * keep breathing; only the faint FAR washes pass behind it.
 *
 * Each cloud is drawn in LOCAL space around the origin, then a single
 * group transform places it (translate + drift), rotates it (`rot`,
 * radians) and squashes it to an ellipse (`aspect` = minor/major). Three
 * layers per cloud:
 *   A · body      — RadialGradient + heavy BlurMask (volumetric)
 *   B · texture    — FractalNoise (octaves 3) masked by a radial falloff,
 *                    tinted to the hue → filaments a flat shape can't fake
 *   C · highlight  — a small warm gradient offset off-centre → the
 *                    brighter star-forming core of a real nebula
 * Hues stay inside warm-black + magenta (no cyan/blue). The noise seed is
 * NEVER animated (that reads as boiling water); only position drifts. */
// NEAR clouds are tilted to a SHARED counter-clockwise swirl around the
// centre (opposite quadrants share the same tilt sign) so the four
// framing ellipses read as one rotation the eye follows inward, instead
// of crossing at random angles. The FAR washes are bigger, fainter and
// more diffuse than before so the two planes separate cleanly.
const NEBULAE = [
  // FAR plane — big, faint, slow, elongated diagonal haze. Off-centre so
  // their cores never sit dead-behind the galaxy.
  {
    depth: 'far',
    fx: 0.34,
    fy: 0.4,
    r: 1.05,
    aspect: 0.38,
    rot: -0.55,
    color: '#5A2A64',
    hl: '#7A2A60',
    peak: 0.07,
    tex: 0.06,
    freq: 0.008,
    dx: 3,
    dy: 2,
    ph: 0.12,
    seed: 7,
  },
  {
    depth: 'far',
    fx: 0.66,
    fy: 0.62,
    r: 0.95,
    aspect: 0.44,
    rot: 0.7,
    color: '#742A50',
    hl: '#A23E58',
    peak: 0.06,
    tex: 0.06,
    freq: 0.009,
    dx: 3,
    dy: 2,
    ph: 0.52,
    seed: 17,
  },
  // NEAR plane — framing ellipses, tilted to a shared CCW swirl.
  {
    depth: 'near',
    fx: 0.22,
    fy: 0.26,
    r: 0.5,
    aspect: 0.56,
    rot: -0.9,
    color: '#6A2A66',
    hl: '#A23E58',
    peak: 0.2,
    tex: 0.13,
    freq: 0.014,
    dx: 7,
    dy: 6,
    ph: 0.0,
    seed: 11,
  },
  {
    depth: 'near',
    fx: 0.8,
    fy: 0.72,
    r: 0.54,
    aspect: 0.52,
    rot: -0.9,
    color: '#8C2A52',
    hl: '#A23E58',
    peak: 0.2,
    tex: 0.13,
    freq: 0.013,
    dx: 8,
    dy: 6,
    ph: 0.34,
    seed: 23,
  },
  {
    depth: 'near',
    fx: 0.74,
    fy: 0.16,
    r: 0.38,
    aspect: 0.6,
    rot: 0.9,
    color: '#7A2A60',
    hl: '#A23E58',
    peak: 0.14,
    tex: 0.11,
    freq: 0.016,
    dx: 6,
    dy: 7,
    ph: 0.62,
    seed: 37,
  },
  {
    depth: 'near',
    fx: 0.26,
    fy: 0.82,
    r: 0.42,
    aspect: 0.54,
    rot: 0.9,
    color: '#4A2A5E',
    hl: '#9A3E58',
    peak: 0.13,
    tex: 0.11,
    freq: 0.015,
    dx: 6,
    dy: 5,
    ph: 0.86,
    seed: 53,
  },
] as const

function NebulaCloud({
  cloud,
  drift,
  w,
  h,
  reduced,
}: {
  cloud: (typeof NEBULAE)[number]
  drift: SharedValue<number>
  w: number
  h: number
  reduced: boolean
}) {
  const cx = cloud.fx * w
  const cy = cloud.fy * h
  // Radius scales with width so clouds stay proportional on any screen.
  const R = cloud.r * w
  // Place + drift + rotate + squash-to-ellipse, all in one transform.
  // Drawing happens in LOCAL space (origin 0,0) below, so rotate/scale
  // pivot on the cloud centre. scaleY = aspect turns the circle into an
  // ellipse; rotate tilts it. The noise rect + gradients ride the same
  // transform, so the filaments stretch along the ellipse — exactly the
  // anisotropy that sells a gas cloud.
  const transform = useDerivedValue(() => {
    const driftX = reduced ? 0 : Math.cos((drift.value + cloud.ph) * 2 * Math.PI) * cloud.dx
    const driftY = reduced ? 0 : Math.sin((drift.value + cloud.ph) * 2 * Math.PI) * cloud.dy
    return [
      { translateX: cx + driftX },
      { translateY: cy + driftY },
      { rotate: cloud.rot },
      { scaleX: 1 },
      { scaleY: cloud.aspect },
    ]
  })
  const far = cloud.depth === 'far'
  // FAR washes blur more (softer, more distant) and keep their highlight
  // low; NEAR clouds stay crisper and let the star-forming highlight
  // read more, so the two planes separate.
  const bodyBlur = far ? R * 0.42 : R * 0.3
  const hlAlpha = cloud.peak * (far ? 0.5 : 0.8)
  return (
    <SkiaGroup transform={transform}>
      {/* A · volumetric body */}
      <SkiaCircle c={vec(0, 0)} r={R}>
        <SkiaRadialGradient
          c={vec(0, 0)}
          r={R}
          colors={[
            hexA(cloud.color, cloud.peak),
            hexA(cloud.color, cloud.peak * 0.35),
            hexA(cloud.color, 0),
          ]}
        />
        <BlurMask blur={bodyBlur} style="normal" />
      </SkiaCircle>
      {/* B · filament texture — noise as a luminance mask over a hue
          gradient, faded to nothing at the cloud edge. `screen` so the
          filaments read as faint light, never as grain. */}
      <SkiaGroup opacity={cloud.tex} blendMode="screen">
        <Mask
          mode="luminance"
          mask={
            <SkiaRect x={-R} y={-R} width={R * 2} height={R * 2}>
              <FractalNoise freqX={cloud.freq} freqY={cloud.freq} octaves={3} seed={cloud.seed} />
            </SkiaRect>
          }
        >
          <SkiaCircle c={vec(0, 0)} r={R}>
            <SkiaRadialGradient
              c={vec(0, 0)}
              r={R}
              colors={[hexA(cloud.color, 1), hexA(cloud.color, 0)]}
            />
          </SkiaCircle>
        </Mask>
      </SkiaGroup>
      {/* C · warm off-centre highlight — the brighter star-forming core.
          Alpha tracks `peak` so the faint FAR washes don't get a hot spot. */}
      <SkiaGroup blendMode="screen">
        <SkiaCircle c={vec(R * 0.18, -R * 0.14)} r={R * 0.42}>
          <SkiaRadialGradient
            c={vec(R * 0.18, -R * 0.14)}
            r={R * 0.42}
            colors={[hexA(cloud.hl, hlAlpha), hexA(cloud.hl, 0)]}
          />
          <BlurMask blur={R * 0.18} style="normal" />
        </SkiaCircle>
      </SkiaGroup>
    </SkiaGroup>
  )
}

/* The Skia nebula field — one Canvas behind the SVG starfield. */
function SkiaNebulae({
  width,
  height,
  drift,
  reduced,
}: {
  width: number
  height: number
  drift: SharedValue<number>
  reduced: boolean
}) {
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {NEBULAE.map((cloud, i) => (
        <NebulaCloud key={i} cloud={cloud} drift={drift} w={width} h={height} reduced={reduced} />
      ))}
    </Canvas>
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
  width = DEFAULT_W,
  height = DEFAULT_W,
  starCount = 57,
}: {
  t: SharedValue<number>
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
  // Nebulae moved to the Skia layer (SkiaNebulae, behind this SVG); this
  // SVG keeps only the starfield + the occasional shooting star.
  return (
    <G>
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
  const reduced = useReducedMotion() ?? false
  const t = useSharedValue(0)
  const drift = useSharedValue(0)
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    // Slow nebula drift — ~60 s/cycle, subliminal. (Was 44 s.)
    drift.value = withRepeat(withTiming(1, { duration: 60000, easing: Easing.linear }), -1, false)
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
      {/* Nebulae (Skia, real blur + filament noise) behind the SVG
          starfield, which overlays at the same bounds. */}
      <SkiaNebulae width={width} height={height} drift={drift} reduced={reduced} />
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={StyleSheet.absoluteFill}
      >
        <Cosmos t={t} width={width} height={height} starCount={starCount} />
      </Svg>
    </View>
  )
}
