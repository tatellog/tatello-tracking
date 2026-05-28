import * as Haptics from 'expo-haptics'
import React, { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Image as SvgImage,
  Line,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg'

import { colors, typography } from '@/theme'

// The hero artwork — paints the BH + accretion + cardinal
// sparkles + axis diamonds. The programmatic layers around it
// (nebula clouds, deep starfield, orbital rings) complement this
// painting rather than duplicate it.
const MONTH_ART_PNG = require('@/assets/orbits-art/orbit-month-bh.png')

/** A satellite slot in the hero — agnostic to whether it represents
 *  a confirmed pattern (mature view) or a first-month observation.
 *  `kind` is the single source of truth for the visual treatment:
 *    · peak       — warm, brighter glow (high-energy day/event)
 *    · valley     — cool, quieter glow (low-energy day/event)
 *    · stable     — solid magenta frame ring (steady anchor)
 *    · tentative  — dashed halo (hypothesis, not confirmed) */
export type SatelliteKind = 'peak' | 'valley' | 'stable' | 'tentative'
export type Satellite = {
  id: string
  label: string
  kind?: SatelliteKind
  selected?: boolean
}

/*
 * The Mes hero — "Tu Cielo": a painted black hole + accretion disk
 * (orbit-month.png) sits at the centre, surrounded by a programmatic
 * cosmic system: dashed orbital rings, 4-pointed sparkle stars at
 * the cardinal points, bright comets on the rings, and a deep
 * background starfield. The four pattern satellites float at the
 * corners. Layers, back to front:
 *
 *   1. Background starfield (twinkling sparse specks)
 *   2. Magenta nebula glow (subtle radial wash)
 *   3. Orbital rings (5 dashed ellipses at varying tilts)
 *   4. Black-hole PNG
 *   5. Sparkle stars (4-pointed crosses at top/bottom/sides)
 *   6. Comets (bright tear-drops with trailing tails)
 *   7. Tiny orbital markers (small diamonds on the rings)
 *   8. Satellites + tap-targets
 */

const W = 372
const CX = W / 2
const CY = W / 2
const HIT = 56

// Art size + offset — the BH PNG is rendered at 320×320 with a
// horizontal nudge LEFT so the cosmos doesn't sit directly behind
// the chain on the right edge. The painted BH is compact in the
// PNG's centre with extended fade-out; the bounding box overlaps
// with the chain area but only via the transparent fade, so chain
// badges + halos remain visible. Vertical: centred. Horizontal:
// ~18 px left of canvas centre.
const ART_SIZE = 320
const ART_OFFSET_X = (W - ART_SIZE) / 2 - 18 // nudged LEFT
const ART_OFFSET_Y = (W - ART_SIZE) / 2 // centred vertically

const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedLine = Animated.createAnimatedComponent(Line)
const AnimatedPath = Animated.createAnimatedComponent(Path)

/** Deterministic 1-D PRNG — same seed → same star field every render. */
function rand(seed: number, i: number): number {
  const s = Math.sin(seed * 9301 + i * 49297) * 233280
  return s - Math.floor(s)
}

/** Background starfield — a sparse sprinkle so the eye reads
 *  "deep cosmic void", not "Milky Way". 70 candidates, ~55
 *  survive the central skip-zone around the BH. */
type Star = { x: number; y: number; r: number; op: number; phase: number }
const STARS: readonly Star[] = Array.from({ length: 70 }, (_, i) => {
  const x = rand(11, i) * W
  const y = rand(12, i) * W
  if (Math.hypot(x - CX, y - CY) < 60) return null
  return {
    x,
    y,
    r: 0.25 + rand(13, i) * 0.6,
    op: 0.25 + rand(14, i) * 0.45,
    phase: rand(15, i),
  } as Star
}).filter((s): s is Star => s !== null)

/** Deep starfield — 80 candidate distant pinpoints painted ON the
 *  cosmic backdrop (below the foreground twinkling stars). Tinier
 *  + dimmer + static — the layer that pushes the visual horizon
 *  further away, Genshin-style. */
type DeepStar = { x: number; y: number; r: number; op: number }
const DEEP_STARS: readonly DeepStar[] = Array.from({ length: 80 }, (_, i) => {
  const x = rand(31, i) * W
  const y = rand(32, i) * W
  if (Math.hypot(x - CX, y - CY) < 50) return null
  return {
    x,
    y,
    r: 0.15 + rand(33, i) * 0.4,
    op: 0.1 + rand(34, i) * 0.32,
  } as DeepStar
}).filter((s): s is DeepStar => s !== null)

/** Art-only palette for the Mes hero. These colours don't belong in
 *  `theme/colors.ts` because they're scene-specific (nebula tints,
 *  star core whites, halo/aura pinks + violets that read against a
 *  near-black BH). Centralised here so the cosmos has a single
 *  source of truth and tweaking the mood is a one-block edit. */
const SKY = {
  // Nebula radial-gradient clouds painted off the BH axis.
  nebulaPurple: '#4A1545',
  nebulaMagenta: '#5C1838',
  nebulaDark: '#3A0C28',
  nebulaDeep: '#2C0A1F',
  // BH plasma rim (used in the radial gradient under the painting).
  plasmaRim: '#9A3858',
  // Halo + aura pinks/violets — one row per satellite kind treatment.
  haloPeach: '#F4ABC8',
  haloPeachWarm: '#FFCDA8',
  haloViolet: '#A48BC8',
  auraPink: '#FBD7E3',
  auraPale: '#FCE5EE',
  auraVioletPale: '#C9B5D8',
  // Bright star / pin core.
  starCore: '#FFFFFF',
} as const

/** Off-centre nebula clouds — soft radial gradients painted on
 *  the cosmic backdrop to add atmospheric depth. Each cloud lives
 *  off the BH axis so the cosmos feels asymmetric and lived-in,
 *  not a flat magenta wash. */
const NEBULA_CLOUDS: readonly {
  cx: number
  cy: number
  r: number
  color: string
  opacity: number
}[] = [
  { cx: 86, cy: 104, r: 130, color: SKY.nebulaPurple, opacity: 0.28 },
  { cx: 284, cy: 248, r: 142, color: SKY.nebulaMagenta, opacity: 0.3 },
  { cx: 312, cy: 76, r: 100, color: SKY.nebulaDark, opacity: 0.22 },
  { cx: 60, cy: 290, r: 110, color: SKY.nebulaDeep, opacity: 0.2 },
]

/** Orbital rings — sparse dotted ellipses sized to orbit AROUND
 *  the scaled-down PNG (260 px = 130 px half-extent from centre).
 *  Each rx/ry is comfortably > 130 so the dotted ring tracks
 *  visibly outside the painted plasma rather than being swallowed
 *  by it. Three rings at distinct tilts give a sense of orbital
 *  inclination without the busy six-ring nest of v2. */
const ORBITS: readonly {
  rx: number
  ry: number
  rotation: number
  strokeWidth: number
  dash: string
  opacity: number
}[] = [
  // Main ring — prominent horizontal tilt around the BH
  { rx: 158, ry: 144, rotation: -8, strokeWidth: 0.6, dash: '0.5 5', opacity: 0.8 },
  // Wide tilted outer ring — same orbital plane rotated outward
  { rx: 178, ry: 134, rotation: 22, strokeWidth: 0.55, dash: '0.5 5.5', opacity: 0.62 },
  // Vertical-leaning ring — counter-tilt for orbital depth
  { rx: 140, ry: 175, rotation: -30, strokeWidth: 0.55, dash: '0.5 5.5', opacity: 0.6 },
]

/** Bright pin-point nodes scattered on the orbital rings — replace
 *  the long-tailed comets with simple "bright spots where the orbit
 *  shines" (matches the reference's clean dots). All positions sit
 *  OUTSIDE the 130-px PNG radius so they're visible on the cosmic
 *  background, not buried inside the painted plasma. */
const NODES: readonly { x: number; y: number; size: number }[] = [
  { x: 332, y: 168, size: 1.1 }, // far-right (3 o'clock)
  { x: 40, y: 205, size: 1.05 }, // far-left (9 o'clock)
  { x: 305, y: 92, size: 0.95 }, // upper-right (2 o'clock)
  { x: 70, y: 268, size: 1 }, // lower-left (8 o'clock)
  { x: 232, y: 322, size: 0.95 }, // lower-right (5 o'clock)
  { x: 140, y: 50, size: 0.85 }, // upper-left (11 o'clock, small)
]

/** Pattern-chain positions — vertical S-curve on the right side
 *  of the canvas. Constraints: x must be > 250 (out of BH plasma
 *  zone) and < W - 28 (chain badge half-width) so labels read
 *  clean. Adjust the spacing if the SatBody halo radius changes. */
const SAT_POS: readonly { x: number; y: number }[] = [
  { x: 296, y: 72 },
  { x: 282, y: 142 },
  { x: 282, y: 214 },
  { x: 296, y: 286 },
]

/* A single background star — twinkles asynchronously via its
 * `phase`. Bright at the peak of its wave, ~40 % of base at the
 * trough. */
function TwinkleStar({ star, clock }: { star: Star; clock: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((clock.value + star.phase) * 2 * Math.PI)
    return { opacity: star.op * (0.4 + 0.6 * wave) }
  })
  return (
    <AnimatedCircle
      cx={star.x}
      cy={star.y}
      r={star.r}
      fill={SKY.starCore}
      animatedProps={animatedProps}
    />
  )
}

/* A bright pin-point node on an orbital ring — bloom + glow +
 * nucleus stack. No tail; clean static bright spots that mark
 * "this orbit has activity" without competing with the BH. */
function NodePoint({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={3.5 * size} fill={SKY.auraPink} opacity={0.25} />
      <Circle cx={x} cy={y} r={2.2 * size} fill={SKY.auraPale} opacity={0.55} />
      <Circle cx={x} cy={y} r={1.1 * size} fill={SKY.starCore} />
    </G>
  )
}

/* A satellite halo — the breathing glow around a chain item. The
 * core of the item is the pattern ICON rendered as an RN View
 * outside the SVG (see `PatternChainIcon`). Visual treatment
 * varies by `kind`:
 *   · peak       — warm peach glow, bright + saturated
 *   · valley     — cool violet glow, quieter
 *   · stable     — default + an extra solid magenta frame ring
 *   · tentative  — DASHED halo (hypothesis, not confirmed) */
function SatBody({
  x,
  y,
  clock,
  phase,
  kind,
  selected,
}: {
  x: number
  y: number
  clock: SharedValue<number>
  phase: number
  kind?: SatelliteKind
  selected?: boolean
}) {
  // Resolve halo colours + tone per kind. Falls back to the
  // generic peach if no kind was specified (mature pattern view).
  let haloFill: string = SKY.haloPeach
  let auraFill: string = SKY.auraPink
  let haloOp = 0.14
  let auraOp = 0.16
  switch (kind) {
    case 'peak':
      haloFill = SKY.haloPeachWarm // warmer peach — high energy
      auraFill = SKY.auraPink
      haloOp = 0.18
      auraOp = 0.2
      break
    case 'valley':
      haloFill = SKY.haloViolet // cool violet — low energy
      auraFill = SKY.auraVioletPale
      haloOp = 0.13
      auraOp = 0.14
      break
    case 'stable':
      // default warm — but with an extra solid magenta frame
      // ring added below for the "anchor" feel.
      haloFill = SKY.haloPeach
      auraFill = SKY.auraPink
      haloOp = 0.14
      auraOp = 0.16
      break
    case 'tentative':
      haloFill = SKY.auraPale // pale, dashed
      auraFill = SKY.auraPink
      haloOp = 0.32
      auraOp = 0.12
      break
  }

  const breath = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((clock.value * 0.5 + phase) * 2 * Math.PI)
    // Stable patterns breathe LESS — they're the steady ones.
    // Tentative breathes a touch quieter than peak/valley.
    const amplitude = kind === 'stable' ? 0.04 : kind === 'tentative' ? 0.06 : 0.09
    const scale = 1 + wave * amplitude
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { scale },
        { translateX: -x },
        { translateY: -y },
      ],
    }
  })
  return (
    <AnimatedG animatedProps={breath}>
      {/* Halo — solid filled disc for peak/valley/stable; DASHED
          stroke for tentative (the "hypothesis ring" treatment). */}
      {kind === 'tentative' ? (
        <Circle
          cx={x}
          cy={y}
          r={SAT_HALO_R}
          fill="none"
          stroke={haloFill}
          strokeWidth={1}
          strokeDasharray="2 3"
          strokeLinecap="round"
          opacity={haloOp}
        />
      ) : (
        <Circle cx={x} cy={y} r={SAT_HALO_R} fill={haloFill} opacity={haloOp} />
      )}
      <Circle cx={x} cy={y} r={SAT_AURA_R} fill={auraFill} opacity={auraOp} />
      {/* Stable extra: solid magenta frame ring — the "anchor" cue. */}
      {kind === 'stable' ? (
        <Circle
          cx={x}
          cy={y}
          r={SAT_STABLE_FRAME_R}
          fill="none"
          stroke={colors.magenta}
          strokeWidth={0.8}
          opacity={0.55}
        />
      ) : null}
      {selected ? (
        <Circle
          cx={x}
          cy={y}
          r={SAT_RING_R}
          fill="none"
          stroke={colors.magenta}
          strokeWidth={1.4}
          opacity={1}
        />
      ) : null}
    </AnimatedG>
  )
}

// Chain badge geometry. The chain reads as supporting nav, not
// the visual hero: a 28 px symbol inside a 36 px disc, framed by
// halo + aura + selected rings that scale with these constants —
// resize them as a group rather than tweaking the rings in
// isolation. The halo radii live as viewBox units (372 wide), so
// they aren't 1:1 with the disc/icon pixel sizes.
const PATTERN_ICON_SIZE = 28
const PATTERN_DISC_SIZE = 36
const SAT_HALO_R = 24
const SAT_AURA_R = 19
const SAT_RING_R = 21
const SAT_STABLE_FRAME_R = 22

/* Pattern symbol — a small SVG icon drawn by kind. Replaces the
 * AI-illustrated pattern1-4 PNGs that were too dark at chain-
 * badge size. Each kind gets a distinctive bright shape so the
 * user reads which pattern is which at a glance:
 *   peak     → 4-pointed sparkle (warm peach) — high energy
 *   valley   → crescent moon (cool violet) — low energy
 *   stable   → solid disc + ring (rose) — anchor
 *   tentative → dashed ring + dot (pale cream) — hypothesis
 *
 * Drawn inside an INNER Svg (size px) embedded in the chain
 * badge's RN View. The inner Svg uses a 0–24 viewBox so the
 * shape geometry is independent of the on-screen size. */
function PatternSymbol({ kind, size }: { kind: SatelliteKind | undefined; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {kind === 'peak' ? (
        // 4-pointed sparkle — bright high-energy emblem
        <Path
          d="M 12 2 L 13.4 10.6 L 22 12 L 13.4 13.4 L 12 22 L 10.6 13.4 L 2 12 L 10.6 10.6 Z"
          fill={SKY.haloPeachWarm}
        />
      ) : null}
      {kind === 'valley' ? (
        // Crescent — dip / low-energy emblem
        <Path d="M 16.5 6 A 7.5 7.5 0 1 0 16.5 18 A 6 6 0 1 1 16.5 6 Z" fill={SKY.haloViolet} />
      ) : null}
      {kind === 'stable' ? (
        // Solid disc + ring — anchor / steady emblem
        <G>
          <Circle cx="12" cy="12" r="7.5" fill="none" stroke={SKY.haloPeach} strokeWidth="1.6" />
          <Circle cx="12" cy="12" r="3.4" fill={SKY.haloPeach} />
        </G>
      ) : null}
      {kind === 'tentative' ? (
        // Dashed ring + centre dot — hypothesis-in-formation
        <G>
          <Circle
            cx="12"
            cy="12"
            r="7.5"
            fill="none"
            stroke={SKY.auraPale}
            strokeWidth="1.2"
            strokeDasharray="2 2.4"
            strokeLinecap="round"
          />
          <Circle cx="12" cy="12" r="1.6" fill={SKY.auraPale} />
        </G>
      ) : null}
    </Svg>
  )
}

/* The pattern icon — an RN View overlaying the canvas at the
 * chain item position. The visual core is a PatternSymbol drawn
 * by `kind`. Breath is synchronised with `SatBody` via the same
 * `clock + phase` waveform so the icon and its halo pulse
 * together. The `affordance` flag adds an extra "tap me" pulse —
 * used on the first chain item before the user has interacted,
 * so the chain is discoverable. */
function PatternChainIcon({
  pos,
  kind,
  clock,
  phase,
  dimmed,
  affordance,
}: {
  pos: { x: number; y: number }
  kind: SatelliteKind | undefined
  clock: SharedValue<number>
  phase: number
  dimmed?: boolean
  affordance?: boolean
}) {
  const isTentative = kind === 'tentative'
  const animatedStyle = useAnimatedStyle(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((clock.value * 0.5 + phase) * 2 * Math.PI)
    let scale = 1 + wave * (isTentative ? 0.06 : 0.09)
    // Affordance pulse: a stronger periodic scale boost (~1.5 s
    // sub-period) layered on top of the breath. Cues "tap me"
    // without an explicit text label.
    if (affordance) {
      const cue = 0.5 + 0.5 * Math.sin(clock.value * 3.3 * 2 * Math.PI)
      scale *= 1 + cue * 0.08
    }
    return { transform: [{ scale }] }
  })
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.chainIconWrap,
        animatedStyle,
        {
          left: `${(pos.x / W) * 100}%`,
          top: `${(pos.y / W) * 100}%`,
          opacity: (dimmed ? 0.35 : 1) * (isTentative ? 0.7 : 1),
        },
      ]}
    >
      <View style={styles.chainIconDisc}>
        <PatternSymbol kind={kind} size={PATTERN_ICON_SIZE} />
      </View>
    </Animated.View>
  )
}

/* IGNITION FLARE — a Genshin-style lens flare: large bloom +
 * medium glow + bright core + 4 cross rays (vertical, horizontal,
 * two diagonals). Scales in from 0 → 1 with a back-ease overshoot;
 * delay parameter staggers multiple flares so they ignite
 * sequentially rather than all at once. */
function IgnitionFlare({
  x,
  y,
  delay,
  size = 1,
}: {
  x: number
  y: number
  delay: number
  size?: number
}) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 300, easing: Easing.out(Easing.back(2)) }))
    return () => cancelAnimation(t)
  }, [t, delay])
  const bloomProps = useAnimatedProps(() => {
    'worklet'
    return { opacity: t.value * 0.32, r: 4 + t.value * 22 * size }
  })
  const glowProps = useAnimatedProps(() => {
    'worklet'
    return { opacity: t.value * 0.7, r: 1.5 + t.value * 10 * size }
  })
  const coreProps = useAnimatedProps(() => {
    'worklet'
    return { opacity: t.value, r: 0.5 + t.value * 2.6 * size }
  })
  const rayGroupProps = useAnimatedProps(() => {
    'worklet'
    return { opacity: t.value * 0.95 }
  })
  const rayLen = 28 * size
  return (
    <G>
      <AnimatedCircle cx={x} cy={y} fill={SKY.haloPeachWarm} animatedProps={bloomProps} />
      <AnimatedCircle cx={x} cy={y} fill={SKY.auraPale} animatedProps={glowProps} />
      <AnimatedG animatedProps={rayGroupProps}>
        {/* Horizontal — longest ray (Genshin's signature). */}
        <Line
          x1={x - rayLen}
          y1={y}
          x2={x + rayLen}
          y2={y}
          stroke={SKY.starCore}
          strokeWidth={0.55}
          strokeOpacity={0.85}
          strokeLinecap="round"
        />
        {/* Vertical — taller than horizontal feels. */}
        <Line
          x1={x}
          y1={y - rayLen * 0.85}
          x2={x}
          y2={y + rayLen * 0.85}
          stroke={SKY.starCore}
          strokeWidth={0.5}
          strokeOpacity={0.8}
          strokeLinecap="round"
        />
        {/* Diagonals — quieter cross. */}
        <Line
          x1={x - rayLen * 0.6}
          y1={y - rayLen * 0.6}
          x2={x + rayLen * 0.6}
          y2={y + rayLen * 0.6}
          stroke={SKY.auraPale}
          strokeWidth={0.35}
          strokeOpacity={0.55}
          strokeLinecap="round"
        />
        <Line
          x1={x + rayLen * 0.6}
          y1={y - rayLen * 0.6}
          x2={x - rayLen * 0.6}
          y2={y + rayLen * 0.6}
          stroke={SKY.auraPale}
          strokeWidth={0.35}
          strokeOpacity={0.55}
          strokeLinecap="round"
        />
      </AnimatedG>
      <AnimatedCircle cx={x} cy={y} fill={SKY.starCore} animatedProps={coreProps} />
    </G>
  )
}

/* IGNITION LINE — a thin magenta thread between two flare points.
 * Draws itself via stroke-dashoffset over ~360 ms after a delay.
 * Forms the sub-constellation that gives multi-flare patterns
 * their unique shape. */
function IgnitionLine({
  x1,
  y1,
  x2,
  y2,
  delay,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  delay: number
}) {
  const len = Math.hypot(x2 - x1, y2 - y1)
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }))
    return () => cancelAnimation(t)
  }, [t, delay])
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    return { strokeDashoffset: len * (1 - t.value), opacity: t.value * 0.55 }
  })
  return (
    <AnimatedLine
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={colors.magentaHot}
      strokeWidth={0.7}
      strokeDasharray={`${len} ${len}`}
      strokeLinecap="round"
      animatedProps={animatedProps}
    />
  )
}

/* Decorative divider — a horizontal magenta line with a small
 * diamond at the midpoint. Sits between the cosmic ignition area
 * and the body text below. Animates in via a stretch from centre
 * outward. Lives inside the front Svg. */
function AnnotationDivider() {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withDelay(420, withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }))
    return () => cancelAnimation(t)
  }, [t])
  const lineProps = useAnimatedProps(() => {
    'worklet'
    return { opacity: t.value * 0.7 }
  })
  const diamondProps = useAnimatedProps(() => {
    'worklet'
    return { opacity: t.value * 0.95 }
  })
  // Divider sits in the left-center, below the cosmic ignition
  // area, ABOVE the body text. Width 100 px, centred at x=150.
  const cx = 150
  const cy = 268
  const half = 50
  return (
    <G>
      <AnimatedLine
        x1={cx - half}
        y1={cy}
        x2={cx + half}
        y2={cy}
        stroke={colors.magenta}
        strokeWidth={0.7}
        strokeLinecap="round"
        animatedProps={lineProps}
      />
      <AnimatedPath
        d={`M ${cx} ${cy - 3.4} L ${cx + 3.4} ${cy} L ${cx} ${cy + 3.4} L ${cx - 3.4} ${cy} Z`}
        fill={colors.magenta}
        animatedProps={diamondProps}
      />
    </G>
  )
}

/* Annotation overlay — three RN Text views absolutely positioned
 * over the cosmos canvas. Eyebrow at top, body below the divider,
 * status pill at bottom. Width capped at ~62 % of the canvas so
 * none of the text crashes into the chain column on the right. */
function AnnotationOverlay({
  eyebrow,
  body,
  statusLabel,
  tentative,
}: {
  eyebrow: string
  body: string
  statusLabel: string
  tentative?: boolean
}) {
  const eyebrowT = useSharedValue(0)
  const bodyT = useSharedValue(0)
  const statusT = useSharedValue(0)
  useEffect(() => {
    eyebrowT.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) })
    bodyT.value = withDelay(540, withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }))
    statusT.value = withDelay(
      720,
      withTiming(1, { duration: 240, easing: Easing.out(Easing.back(1.6)) }),
    )
    return () => {
      cancelAnimation(eyebrowT)
      cancelAnimation(bodyT)
      cancelAnimation(statusT)
    }
  }, [eyebrowT, bodyT, statusT])

  const eyebrowStyle = useAnimatedStyle(() => {
    'worklet'
    return { opacity: eyebrowT.value }
  })
  const bodyStyle = useAnimatedStyle(() => {
    'worklet'
    return { opacity: bodyT.value }
  })
  const statusStyle = useAnimatedStyle(() => {
    'worklet'
    const scale = 0.92 + statusT.value * 0.08
    return { opacity: statusT.value, transform: [{ scale }] }
  })

  return (
    <>
      <Animated.View style={[annotationStyles.eyebrowWrap, eyebrowStyle]} pointerEvents="none">
        <Text style={annotationStyles.eyebrowText} numberOfLines={1}>
          {eyebrow}
        </Text>
      </Animated.View>
      <Animated.View style={[annotationStyles.bodyWrap, bodyStyle]} pointerEvents="none">
        <Text style={annotationStyles.bodyText} numberOfLines={3}>
          {body}
        </Text>
      </Animated.View>
      <Animated.View style={[annotationStyles.statusWrap, statusStyle]} pointerEvents="none">
        <View
          style={[
            annotationStyles.statusPill,
            tentative ? annotationStyles.statusPillTentative : annotationStyles.statusPillActive,
          ]}
        >
          <Text
            style={[
              annotationStyles.statusText,
              tentative ? annotationStyles.statusTextTentative : annotationStyles.statusTextActive,
            ]}
          >
            {statusLabel}
          </Text>
        </View>
      </Animated.View>
    </>
  )
}

const annotationStyles = StyleSheet.create({
  // Eyebrow sits at the very top of the cosmos canvas, before the
  // cosmic ignition area. Centered horizontally within the left
  // 64 % so it doesn't approach the chain column.
  eyebrowWrap: {
    position: 'absolute',
    top: '8.5%',
    left: 0,
    right: '36%',
    alignItems: 'center',
  },
  eyebrowText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.magenta,
  },
  // Body — under the divider, multi-line italic serif.
  bodyWrap: {
    position: 'absolute',
    top: '75%',
    left: 0,
    right: '36%',
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  bodyText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13.5,
    lineHeight: 18,
    color: colors.leche,
    textAlign: 'center',
  },
  // Status pill at the bottom — "CONFIRMADA" / "EN OBSERVACIÓN".
  statusWrap: {
    position: 'absolute',
    top: '90%',
    left: 0,
    right: '36%',
    alignItems: 'center',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusPillActive: {
    backgroundColor: colors.magentaTint,
    borderColor: colors.magenta,
  },
  statusPillTentative: {
    backgroundColor: 'transparent',
    borderColor: colors.bruma,
  },
  statusText: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  statusTextActive: {
    color: colors.magenta,
  },
  statusTextTentative: {
    color: colors.niebla,
  },
})

/** Ceremonial flare arrangements per pattern kind. Hard-coded
 *  positions in viewBox coords — chosen aesthetically for each
 *  pattern's character, NOT derived from data. The positions
 *  avoid the chain column on the right (x > 250) so flares
 *  remain unobstructed. */
function getIgnitionLayout(kind: SatelliteKind | undefined): {
  flares: { x: number; y: number; size: number }[]
  lines: { from: number; to: number }[] // indices into flares
} {
  switch (kind) {
    case 'peak':
      return {
        flares: [{ x: 200, y: 90, size: 1.4 }], // single bright flare top-right
        lines: [],
      }
    case 'valley':
      return {
        flares: [{ x: 180, y: 280, size: 1.1 }], // single dim-ish flare bottom
        lines: [],
      }
    case 'stable':
      return {
        flares: [
          { x: 180, y: 100, size: 0.9 },
          { x: 80, y: 190, size: 0.9 },
          { x: 220, y: 250, size: 0.9 },
        ], // triangle suggesting steady anchor
        lines: [
          { from: 0, to: 1 },
          { from: 1, to: 2 },
          { from: 2, to: 0 },
        ],
      }
    case 'tentative':
      return {
        flares: [
          { x: 130, y: 100, size: 0.7 },
          { x: 145, y: 180, size: 0.7 },
          { x: 130, y: 260, size: 0.7 },
        ], // vertical-ish chain — uncertain rhythm
        lines: [
          { from: 0, to: 1 },
          { from: 1, to: 2 },
        ],
      }
    default:
      return { flares: [], lines: [] }
  }
}

export function MonthSky({
  satellites,
  onSatellitePress,
  selectedSatelliteId,
  evidence,
  onCloseSatellite,
}: {
  satellites: readonly Satellite[]
  onSatellitePress?: (id: string) => void
  /** Which chain item is currently active. Drives the
   *  summoned-pattern reveal + the dim-on-others treatment.
   *  `null` = no pattern summoned (cosmos shown clean). */
  selectedSatelliteId?: string | null
  /** Content for the centred "summoned" pattern card: name,
   *  one-line caption, longer body, and tentative flag. The icon
   *  itself comes from the chain (lifted up via fly animation). */
  evidence?: {
    label: string
    caption: string
    detail: string
    tentative?: boolean
  } | null
  /** Called when the user taps the backdrop (anywhere outside
   *  the chain). Used by the parent to clear the selection and
   *  dismiss the summoned pattern. */
  onCloseSatellite?: () => void
}) {
  // Three clocks: `t` (5 s) drives satellite breath; `twinkle`
  // (6 s) drives starfield shimmer; `orbitSpin` (120 s) rotates
  // the dashed orbital rings very slowly — barely perceptible
  // motion, but it keeps the cosmos feeling alive instead of
  // static when the eye lingers.
  const t = useSharedValue(0)
  const twinkle = useSharedValue(0)
  const orbitSpin = useSharedValue(0)

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false)
    twinkle.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false)
    orbitSpin.value = withRepeat(
      withTiming(1, { duration: 120000, easing: Easing.linear }),
      -1,
      false,
    )
    return () => {
      cancelAnimation(t)
      cancelAnimation(twinkle)
      cancelAnimation(orbitSpin)
    }
  }, [t, twinkle, orbitSpin])

  // Rotate the entire orbital-ring group around the BH centre.
  // The orbits are tilted ellipses, so rotation reads as orbital
  // motion (not just a spin) — like watching a planetary system
  // from above.
  const orbitTransform = useAnimatedProps(() => {
    'worklet'
    const deg = orbitSpin.value * 360
    return {
      transform: [
        { translateX: CX },
        { translateY: CY },
        { rotate: `${deg}deg` },
        { translateX: -CX },
        { translateY: -CY },
      ],
    }
  })

  const sats = satellites.slice(0, SAT_POS.length).map((sat, i) => ({
    ...sat,
    x: SAT_POS[i]!.x,
    y: SAT_POS[i]!.y,
    breathPhase: (i * 0.27) % 1,
  }))

  // Look up the active chain item — its position is the origin
  // for the "fly to centre" animation of the summoned pattern.
  const activeSat = selectedSatelliteId
    ? (sats.find((s) => s.id === selectedSatelliteId) ?? null)
    : null

  return (
    <View style={styles.wrap}>
      {/* BACK SVG — everything that should sit BEHIND the painted
          BH art: starfield, nebula wash, vertical dot chain, and
          the orbital rings. The imported MonthArt SVG renders
          between this and the front Svg, so the void occludes the
          parts of these layers that pass through it. */}
      <Svg viewBox={`0 0 ${W} ${W}`} style={[styles.svg, StyleSheet.absoluteFill]}>
        <Defs>
          {/* Inner magenta wash — the centre-warm hue. */}
          <RadialGradient id="m-nebula" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.magenta} stopOpacity={0.08} />
            <Stop offset="60%" stopColor={colors.magenta} stopOpacity={0.02} />
            <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
          </RadialGradient>
          {/* Warm BH aura — a wider magenta-peach glow that pushes
              outward from the void to suggest atmospheric depth. */}
          <RadialGradient id="bh-aura" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={SKY.plasmaRim} stopOpacity={0.32} />
            <Stop offset="55%" stopColor={SKY.nebulaMagenta} stopOpacity={0.12} />
            <Stop offset="100%" stopColor={SKY.nebulaDark} stopOpacity={0} />
          </RadialGradient>
          {/* Nebula cloud gradients — one per cloud. Each is a
              soft radial fade from the cloud's tint at the centre
              to transparent at the edge. */}
          {NEBULA_CLOUDS.map((c, i) => (
            <RadialGradient key={`cloud-grad-${i}`} id={`cloud-${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={c.color} stopOpacity={c.opacity} />
              <Stop offset="55%" stopColor={c.color} stopOpacity={c.opacity * 0.4} />
              <Stop offset="100%" stopColor={c.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>

        {/* DEPTH LAYER A — distant starfield. Tiny, dim, static.
            Pushes the visual horizon further away. */}
        {DEEP_STARS.map((s, i) => (
          <Circle key={`ds-${i}`} cx={s.x} cy={s.y} r={s.r} fill={colors.leche} opacity={s.op} />
        ))}

        {/* DEPTH LAYER B — off-centre nebula clouds. Each is a
            soft radial gradient; together they make the cosmos
            feel asymmetric and atmospheric rather than a flat
            magenta wash. */}
        {NEBULA_CLOUDS.map((c, i) => (
          <Circle key={`cloud-${i}`} cx={c.cx} cy={c.cy} r={c.r} fill={`url(#cloud-${i})`} />
        ))}

        {/* DEPTH LAYER C — warm BH aura. A wider magenta-peach
            halo than the inner wash, pushing the BH's light
            outward into the cosmos for an extra glow shell. */}
        <Circle cx={CX} cy={CY} r={W * 0.42} fill="url(#bh-aura)" />

        {/* Foreground starfield — twinkles asynchronously. */}
        <G>
          {STARS.map((s, i) => (
            <TwinkleStar key={`star-${i}`} star={s} clock={twinkle} />
          ))}
        </G>

        {/* Inner nebula wash — closer-in centre warmth. */}
        <Circle cx={CX} cy={CY} r={W * 0.5} fill="url(#m-nebula)" />

        {/* Pattern connectors — thin magenta threads from each
            chain item curving inward toward the BH centre. The
            PNG renders AFTER this, so its opaque void occludes
            the inner portion of each thread; only the outer arc
            (from chain badge to BH outer edge) remains visible.
            The threads visually anchor the patterns to the
            cosmos — they ORBIT the BH, not float in space. */}
        {SAT_POS.map((pos, i) => {
          // BH centre in the bumped-left layout (ART_OFFSET_X).
          const bhCx = ART_OFFSET_X + ART_SIZE / 2
          const bhCy = ART_OFFSET_Y + ART_SIZE / 2
          // Curved Bezier: control point perpendicular to the
          // chord, biased inward toward the BH. Gives each thread
          // a graceful arc rather than a rigid straight line.
          const midX = (bhCx + pos.x) / 2
          const midY = (bhCy + pos.y) / 2
          // Perpendicular bias — curve "away" from a straight
          // line so the threads arc outward from the BH.
          const dx = pos.x - bhCx
          const dy = pos.y - bhCy
          const len = Math.hypot(dx, dy) || 1
          const nx = -dy / len
          const ny = dx / len
          const bias = 22
          const ctrlX = midX + nx * bias
          const ctrlY = midY + ny * bias
          return (
            <Path
              key={`conn-${i}`}
              d={`M ${bhCx} ${bhCy} Q ${ctrlX} ${ctrlY}, ${pos.x} ${pos.y}`}
              fill="none"
              stroke={colors.magentaHot}
              strokeWidth={0.45}
              strokeOpacity={0.25}
              strokeLinecap="round"
            />
          )
        })}

        {/* Orbital rings — wrapped in an AnimatedG that spins
            very slowly (120 s per turn). The rings are tilted
            ellipses, so the rotation reads as orbital motion. */}
        <AnimatedG animatedProps={orbitTransform}>
          {ORBITS.map((o, i) => (
            <Ellipse
              key={`orbit-${i}`}
              cx={CX}
              cy={CY}
              rx={o.rx}
              ry={o.ry}
              fill="none"
              stroke={SKY.auraPale}
              strokeWidth={o.strokeWidth}
              strokeDasharray={o.dash}
              strokeLinecap="round"
              opacity={o.opacity}
              transform={`rotate(${o.rotation} ${CX} ${CY})`}
            />
          ))}
        </AnimatedG>

        {/* Layer 5 — the BH cosmos PNG. Rendered LAST in the back
            Svg so the painted void occludes any orbital ring +
            vertical dot that would otherwise pass through it.
            Sized to ART_SIZE (260 px) and centred — leaves a 56 px
            margin around for chain items + summoned text to live
            outside the painted plasma. */}
        <SvgImage
          href={MONTH_ART_PNG}
          x={ART_OFFSET_X}
          y={ART_OFFSET_Y}
          width={ART_SIZE}
          height={ART_SIZE}
          preserveAspectRatio="xMidYMid meet"
        />
      </Svg>

      {/* FRONT SVG — bright nodes + chain halos + labels.
          Cardinal sparkles + axis diamonds are PAINTED IN the BH
          PNG; rendering them here too would double up. */}
      <Svg viewBox={`0 0 ${W} ${W}`} style={[styles.svg, StyleSheet.absoluteFill]}>
        {/* Layer 6 — bright pin-point nodes on the rings. */}
        {NODES.map((n, i) => (
          <NodePoint key={`node-${i}`} x={n.x} y={n.y} size={n.size} />
        ))}

        {/* Layer 8 — pattern satellites + labels. When a chain
            item is active, the others dim to 35 % so the focus
            stays on the selected pattern + its evidence. */}
        {sats.map((sat) => {
          // labelX = sat.x - (disc half-width + small gap) so the
          // label sits clear of the badge edge.
          const labelX = sat.x - PATTERN_DISC_SIZE / 2 - 6
          const labelY = sat.y + 3
          const dimmed = activeSat != null && activeSat.id !== sat.id
          return (
            <G key={sat.id} opacity={dimmed ? 0.35 : 1}>
              <SatBody
                x={sat.x}
                y={sat.y}
                clock={t}
                phase={sat.breathPhase}
                kind={sat.kind}
                selected={sat.selected}
              />
              <SvgText
                x={labelX}
                y={labelY}
                textAnchor="end"
                fontFamily={typography.uiBold}
                fontSize={10}
                letterSpacing={1.2}
                fill={sat.selected ? colors.magenta : colors.leche}
                opacity={sat.selected ? 1 : sat.kind === 'tentative' ? 0.55 : 0.85}
              >
                {sat.label}
              </SvgText>
            </G>
          )
        })}
      </Svg>

      {/* Pattern icons — rendered as RN Views overlaying the
          canvas. They can't live inside the Svg (nesting Svgs
          isn't supported), so this layer sits between the SVG
          halos (back) and the tap targets (front). The ACTIVE
          satellite's icon is hidden here — it "flew" up to the
          centre as the SummonedPattern icon. The first item gets
          an affordance pulse when nothing is selected, so the
          chain is discoverable. */}
      {sats.map((sat, i) => {
        // Active chain item stays VISIBLE in the chain — it
        // doesn't fly to centre anymore. The selected ring (drawn
        // by SatBody when sat.selected is true) highlights it.
        const isActive = activeSat?.id === sat.id
        const dimmed = activeSat != null && !isActive
        const affordance = i === 0 && activeSat == null
        return (
          <PatternChainIcon
            key={`icon-${sat.id}`}
            pos={{ x: sat.x, y: sat.y }}
            kind={sat.kind}
            clock={t}
            phase={sat.breathPhase}
            dimmed={dimmed}
            affordance={affordance}
          />
        )
      })}

      {/* ANNOTATED COSMOS REVEAL — when a chain item is active, the
          cosmos lights up with Genshin-style lens flares + connecting
          lines, and the pattern's text annotations are layered into
          the canvas as if it were a page from an astronomy book.
          No lateral panel, no bottom sheet — the cosmos IS the page.
          All visual layers re-mount on `key={selectedSatelliteId}`
          so the ignition animations re-fire fresh on each pattern
          switch. */}
      {activeSat && evidence ? (
        <React.Fragment key={`ignite-${activeSat.id}`}>
          {/* SVG layer — flares + connecting lines + decorative
              divider. pointerEvents=none so taps fall through to
              the backdrop. */}
          <Svg
            viewBox={`0 0 ${W} ${W}`}
            style={[styles.svg, StyleSheet.absoluteFill]}
            pointerEvents="none"
          >
            {(() => {
              const layout = getIgnitionLayout(activeSat.kind)
              return (
                <>
                  {/* Connecting lines (drawn UNDER flares) */}
                  {layout.lines.map((line, i) => {
                    const a = layout.flares[line.from]!
                    const b = layout.flares[line.to]!
                    return (
                      <IgnitionLine
                        key={`il-${i}`}
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        delay={260 + i * 80}
                      />
                    )
                  })}
                  {/* Lens flares — staggered ignition */}
                  {layout.flares.map((f, i) => (
                    <IgnitionFlare
                      key={`if-${i}`}
                      x={f.x}
                      y={f.y}
                      delay={80 + i * 80}
                      size={f.size}
                    />
                  ))}
                  {/* Decorative divider between cosmic area and
                      body text — a thin magenta line with a tiny
                      diamond marker at the mid-point. */}
                  <AnnotationDivider />
                </>
              )
            })()}
          </Svg>

          {/* RN Text overlays — eyebrow at top, body in the
              lower-left, status pill bottom-left. Width capped at
              ~64 % of the canvas so they don't crash into the
              chain on the right. pointerEvents=none. */}
          <AnnotationOverlay
            eyebrow={
              (evidence.tentative ? 'STELAR APRENDE · ' : 'OBSERVACIÓN · ') +
              evidence.label.toUpperCase()
            }
            body={evidence.detail}
            statusLabel={evidence.tentative ? 'EN OBSERVACIÓN' : 'CONFIRMADA'}
            tentative={evidence.tentative}
          />

          {/* Backdrop — captures taps outside the chain Pressables
              (rendered after this Fragment, so they're on top). */}
          <Pressable
            onPress={onCloseSatellite}
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Cerrar patrón"
          />
        </React.Fragment>
      ) : null}

      {/* Tap targets — rendered only when the parent provides a
          press handler. First cycle omits this: observations are
          informational, not navigable. */}
      {onSatellitePress
        ? sats.map((sat) => (
            <Pressable
              key={sat.id}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {})
                onSatellitePress(sat.id)
              }}
              style={[styles.hit, { left: `${(sat.x / W) * 100}%`, top: `${(sat.y / W) * 100}%` }]}
              accessibilityRole="button"
              accessibilityLabel={sat.label}
            />
          ))
        : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    aspectRatio: 1,
  },
  svg: {
    width: '100%',
    height: '100%',
  },
  // Pattern badge overlay — the dark disc + icon. Positioned by
  // percentage with negative margin = -half disc size to centre on
  // the chain item's viewBox coords. pointerEvents="none" so taps
  // fall through to the Pressable tap target below.
  chainIconWrap: {
    position: 'absolute',
    width: PATTERN_DISC_SIZE,
    height: PATTERN_DISC_SIZE,
    marginLeft: -PATTERN_DISC_SIZE / 2,
    marginTop: -PATTERN_DISC_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The dark frame BEHIND the pattern icon. Sets it off from the
  // magenta cosmos so the AI-illustrated dark-fill icons stay
  // readable. Thin magenta border + bgCard2 fill = badge feel
  // (chess piece / talisman) without competing with the chain's
  // warm palette.
  chainIconDisc: {
    width: PATTERN_DISC_SIZE,
    height: PATTERN_DISC_SIZE,
    borderRadius: PATTERN_DISC_SIZE / 2,
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.magentaTint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hit: {
    position: 'absolute',
    width: HIT,
    height: HIT,
    marginLeft: -HIT / 2,
    marginTop: -HIT / 2,
  },
})
