import {
  BlurMask,
  Canvas,
  Circle as SkiaCircle,
  Group as SkiaGroup,
  LinearGradient as SkiaLinearGradient,
  Path as SkiaPath,
  RadialGradient as SkiaRadialGradient,
  Rect as SkiaRect,
  vec,
} from '@shopify/react-native-skia'
import * as Haptics from 'expo-haptics'
import React, { memo, useEffect, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  Mask,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg'

// Medallion glyphs — ALL four now share ONE régime: `currentColor` filled
// silhouettes tinted gold (like `shine-tint`), so the chain reads as one
// family. `rest-tint`/`anchor-tint` are the currentColor variants of the old
// multi-colour amber illustrations; `tentative` is drawn inline as a
// telescope reticle (so "observa" isn't just another star).
import AnchorArt from '@/assets/orbits-art/anchor-tint.svg'
// The four REVEAL emblems all use OUTLINE (stroke-only, fill:none) variants
// so every reveal speaks ONE drawing language — a uniform "observatory-ink"
// engraving behind the constellation (homogenization: the PAGE is constant,
// the dimension colour lives only in the constellation on top). All four are
// rendered in `EMBLEM_INK` (gold-cream) at the same opacity, NOT tinted by
// dimension.
import AnchorLineArt from '@/assets/orbits-art/orbit-anchor-line.svg'
// Radial star (sparkle) outline — the emblem behind the `tu brillo` BURST
// constellation. Centred + symmetric, matching the radial burst (the old
// vertical orbit-shine figure mismatched the new burst).
import ShineFigureArt from '@/assets/orbits-art/shine-tint-line.svg'
import WatchFigureArt from '@/assets/orbits-art/orbit-watch-line.svg'
import MoonArt from '@/assets/orbits-art/orbit-moon-line.svg'
import RestArt from '@/assets/orbits-art/rest-tint.svg'
// `shine-tint.svg` is a `currentColor` variant of `shine.svg` (whose 14
// paths are hard `fill="#000"`, invisible on the dark sky). The tint
// variant lets us paint it gold via the `color` prop on the component.
import ShineArt from '@/assets/orbits-art/shine-tint.svg'
import { colors, typography } from '@/theme'

import { type DimensionKey } from '../logic'
import { useScreenActive } from '../useScreenActive'

// NOTE: the BH hero PNG (orbit-month-bh.png) is temporarily removed so the
// satellite chain is the protagonist. To restore: re-add `Image as SvgImage`
// to the react-native-svg import, the MONTH_ART_PNG require + ART_SIZE /
// ART_OFFSET_X / ART_OFFSET_Y consts, and the <SvgImage> layer in the back Svg.

/** A satellite slot in the hero — agnostic to whether it represents
 *  a confirmed pattern (mature view) or a first-month observation.
 *  `kind` is the single source of truth for the visual treatment:
 *    · peak       — warm, brighter glow (high-energy day/event)
 *    · valley     — cool, quieter glow (low-energy day/event)
 *    · stable     — solid gold frame ring (steady anchor)
 *    · tentative  — dashed halo (hypothesis, not confirmed)
 *  `dimensionKey` is the single source of truth for the COLOUR:
 *    the shape stays governed by `kind`, but the halo/aura/glyph
 *    tint comes from which of the six dimensions the body is. */
export type SatelliteKind = 'peak' | 'valley' | 'stable' | 'tentative' | 'rising'
export type Satellite = {
  id: string
  label: string
  kind?: SatelliteKind
  dimensionKey: DimensionKey
  selected?: boolean
}

/** The constellation shapes drawn on reveal — one per `kind`. Nodes
 *  are in MonthSky viewBox coords, deliberately in x∈[40,245] /
 *  y∈[70,300] (LEFT/CENTER, clear of the chain column on the right).
 *  `hero:true` = the largest star + pulse anchor. `edges` = the energy
 *  lines; energy flows from the hero outward. `route` = the ORDERED node
 *  indices a current follows through the figure (hero → … outward).
 *  Authored by the illustrator — aesthetic, NOT derived from data. */
const CONSTELLATION_SHAPES: Record<
  SatelliteKind,
  {
    nodes: { x: number; y: number; hero?: boolean; mag?: number }[]
    edges: [number, number][]
    route: number[]
  }
> = {
  // PEAK (tu brillo) — a RADIAL BURST / sparkle: one bright HERO at the centre
  // and 8 rays exploding outward (4 long cardinals + 4 short diagonals), so the
  // brightest dimension of the month reads as light RADIATING, not a figure
  // draining downward. Centred on (143,184). The route lights the core first,
  // then SWEEPS the tips in angular order (N→NE→E→…); each ray draws just as
  // the light reaches its tip (the EnergyLine window-cap makes the long rays
  // draw just-in-time instead of from frame 0), so the burst is TRACED ray by
  // ray, not flashed. The ShineReveal emblem behind is the matching radial
  // star (shine-tint-line), centred.
  peak: {
    nodes: [
      { x: 132, y: 168, hero: true, mag: 1 }, // 0 · centre — the radiant core (hero)
      { x: 132, y: 84, mag: 2 }, // 1 · N (long)
      { x: 168, y: 132, mag: 3 }, // 2 · NE (short)
      { x: 216, y: 168, mag: 2 }, // 3 · E (long)
      { x: 168, y: 204, mag: 3 }, // 4 · SE (short)
      { x: 132, y: 252, mag: 2 }, // 5 · S (long)
      { x: 96, y: 204, mag: 3 }, // 6 · SW (short)
      { x: 48, y: 168, mag: 2 }, // 7 · W (long)
      { x: 96, y: 132, mag: 3 }, // 8 · NW (short)
    ],
    edges: [
      [0, 1], // 8 rays from the core — the burst
      [0, 2],
      [0, 3],
      [0, 4],
      [0, 5],
      [0, 6],
      [0, 7],
      [0, 8],
    ],
    route: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  },
  // VALLEY (tu pausa) — a CRESCENT MOON RING: ~8 bright stars seated on the
  // moon's limb. The thick/bright outer arc is on the RIGHT (stars 0-1-2-3-4,
  // convex right), the crescent OPENS to the LEFT, and the inner/left edge
  // (5-6-7) climbs back up so the stars almost close a ring. Centred on the
  // MoonReveal figure (cx≈126, cy≈164, R≈90 in viewBox px) so the stars sit
  // on the moon's glowing edge. The light paints the crescent of a corrido:
  // hero (upper horn) → down the right arc → lower horn → up the left,
  // landing upper-left (7) near the text. Edges follow the CONTOUR (no
  // centre chords); [7,0] faintly closes the ring.
  valley: {
    nodes: [
      { x: 156, y: 90, hero: true, mag: 1 }, // 0 · upper horn (hero — brightest tip, upper-right)
      { x: 201, y: 125, mag: 2 }, // 1 · right-upper, descending the bright arc
      { x: 214, y: 172, mag: 2 }, // 2 · right flank (3 o'clock — outermost point)
      { x: 194, y: 223, mag: 2 }, // 3 · right-lower, the arc curving back in
      { x: 145, y: 252, mag: 2 }, // 4 · lower horn (bottom-centre)
      { x: 85, y: 228, mag: 3 }, // 5 · lower-left, the inner edge begins
      { x: 54, y: 176, mag: 3 }, // 6 · left flank (9 o'clock, inner/fainter)
      { x: 69, y: 121, mag: 3 }, // 7 · upper-left
      { x: 50, y: 153, mag: 2 }, // 8 · LEFT TIP — extra bright star on the moon's left point
      { x: 78, y: 93, mag: 2 }, // 9 · PEAK — the chain ends here
      { x: 134, y: 84, mag: 2 }, // 10 · LONE STAR — free bright point, no line (sits near the top horn)
    ],
    edges: [
      [0, 1], // upper horn → bright right arc
      [1, 2], // outer arc descending
      [2, 3], // around the right flank
      [3, 4], // → lower horn (closes the bright limb)
      [4, 5], // crossing to the inner/left edge
      [5, 6], // up the left flank
      [6, 8], // → out to the left tip
      [8, 7], // left tip → upper-left
      [7, 9], // → up to the left peak (chain ends here — node 10 is a free star)
    ],
    route: [0, 1, 2, 3, 4, 5, 6, 8, 7, 9],
  },
  // STABLE (tu ancla) — a CURVE that fits the emblem: the 6 stars chain along
  // the LEFT flank of the anchor emblem's ring (orbit-anchor.svg, ring cx≈735
  // cy≈800 r≈430 in SVG space) — a smooth "C" arc bulging left, head at top →
  // base at bottom. OPEN chain (no closing edge) so it reads as a curve, not
  // straight lines crossing the emblem. Light paints the curve top → bottom.
  stable: {
    nodes: [
      { x: 140, y: 84, hero: true, mag: 1 }, // 0 · head / volute (top) — hero
      { x: 90, y: 101, mag: 3 }, // 1 · entering the ring, descending left
      { x: 60, y: 142, mag: 2 }, // 2 · upper-left flank
      { x: 60, y: 195, mag: 4 }, // 3 · left bulge (leftmost point)
      { x: 90, y: 236, mag: 2 }, // 4 · closing the flank, back toward centre
      { x: 140, y: 252, mag: 3 }, // 5 · base (bottom-centre)
      { x: 204, y: 150, mag: 2 }, // 6 · RIGHT POINT — star on the anchor's right side
      { x: 190, y: 250, mag: 2 }, // 7 · BOTTOM-RIGHT — the lower-right fluke tip
    ],
    edges: [
      [0, 1], // chain along the ring's left arc → reads as a curve
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [0, 6], // head → right point
      [5, 7], // base → bottom-right fluke
      [6, 7], // right point → bottom-right fluke (second connection on the last star)
    ],
    // node 7 sits at the END of the route so it stays the LAST star to ignite
    // even with its new [6,7] edge (a branch would otherwise inherit node 6's
    // early time). The light finishes by tracing base → fluke → up the arm.
    route: [0, 1, 2, 3, 4, 5, 7],
  },
  // TENTATIVE (stelar te observa) — a DIAMOND (per the reference): 4 bright
  // stars at top / right / bottom / left forming a closed rhombus, seated on
  // the inner diamond of the watch emblem (WatchReveal) behind it. Symmetric,
  // upright, centred on (140,188), R=78. Right + bottom are the brightest
  // (mag 1), top + left medium. The light paints right → top → left → bottom
  // (landing lower-centre near the text); the closing edge completes the
  // rhombus. No dashed/hypothesis link — the figure is whole.
  tentative: {
    nodes: [
      { x: 216, y: 168, hero: true, mag: 1 }, // 0 · right point (hero — brightest)
      { x: 132, y: 84, mag: 2 }, // 1 · top point (medium)
      { x: 48, y: 168, mag: 2 }, // 2 · left point (medium)
      { x: 132, y: 252, mag: 1 }, // 3 · bottom point (bright; route lands near the text)
    ],
    edges: [
      [0, 1], // right → top
      [1, 2], // top → left
      [2, 3], // left → bottom
      [3, 0], // bottom → right (closes the diamond)
    ],
    route: [0, 1, 2, 3],
  },
  // RISING — a clear ascending STAIRCASE: short, fairly even steps from
  // lower-left to upper-right, with a spark leaping off the middle tread.
  // Legible momentum, not a lone diagonal.
  rising: {
    nodes: [
      { x: 200, y: 84, hero: true, mag: 1 }, // 0 · summit (hero)
      { x: 177, y: 111, mag: 2 }, // 1 · high step
      { x: 148, y: 132, mag: 3 }, // 2 · (tread: horizontal)
      { x: 139, y: 170, mag: 2 }, // 3 · mid step
      { x: 108, y: 191, mag: 3 }, // 4 · (tread: horizontal)
      { x: 99, y: 231, mag: 2 }, // 5 · low step
      { x: 64, y: 252, mag: 3 }, // 6 · base (lower-left)
      { x: 184, y: 160, mag: 4 }, // 7 · spark leaping to the right
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6], // the staircase
      [3, 7], // spark off the middle tread
    ],
    route: [0, 1, 2, 3, 4, 5, 6],
  },
}

/*
 * The Mes hero — "Tu Cielo": the four pattern satellites are now the
 * protagonist. They sit in a vertical chain on the right, threaded by
 * a gold constellation spine (cartography chrome, not magenta) that
 * turns the list into a single SYSTEM. The centre is no longer a void
 * waiting for an object: an off-centre vertical axis-haze pulls the
 * gravity to the chain's column, the left half is soft nebula fog
 * (weight without detail), and the middle is deep textured sky.
 *
 * Each satellite is now an ornamented "talent-node" talisman: a static
 * gold aura, a polished dark medallion field, and a faceted SatFrame
 * (beveled ring + gear teeth + cardinal spikes). Its GLYPH is one of the
 * orbit-art illustrations chosen by `kind` (shine / rest / anchor /
 * watch), riding on top in the RN overlay. Gold/amber is the resting
 * "fire"; the single ACTIVE node IGNITES into the same gold family at
 * its brightest cream (oroLight/oroLeche/white) — no magenta on the
 * node. The active node is the ONLY one that animates (aura breathing +
 * pulsing core + a one-shot ignition flash on tap); the rest stay
 * STATIC — the stillness is the luxury.
 *
 * When a satellite is tapped, the cosmos lights a CONSTELLATION on the
 * left/centre: bloom-stars (the proven WeekConstellation Skia recipe,
 * ported into `MonthConstellationLayer`) connected by THICK glowing
 * energy lines that draw-on + carry a travelling comet, over a faint
 * figure glyph tinted by the satellite's dimension.
 *
 * Layers, back to front:
 *   1. Deep starfield (static distant pinpoints)
 *   2. Nebula clouds (left-weighted fog)
 *   3. Axis-haze (off-centre vertical magenta wash on the chain column)
 *   4. Twinkling foreground starfield
 *   5. Lottie ambient drift
 *   6. Constellation spine + beads (gold double thread)
 *   7. Bright orbital nodes
 *   8. Satellites (talisman frame + aura — active breathes) + labels
 *   9. Pattern glyphs (RN overlay, orbit-art) + tap targets
 *  10. Reveal: figure glyph + Skia constellation (bloom stars + energy
 *      lines) + annotation overlay + backdrop closer
 */

const W = 372
const CX = W / 2
const CY = W / 2
const HIT = 56
// Overscan (px) for the Skia constellation Canvas — it extends this far
// beyond the diagram bounds on every side so a hero bloom near an edge
// bleeds into the margin instead of being clipped. Same idiom as the
// WeekConstellation flare layer.
const FLARE_PAD = 72

// The chain column lives on the right-CENTRE of the canvas. The
// axis-haze + nebula counterweight key off this so the cosmos
// gravity follows the chain (now pulled inward), not the bare edge.
const AXIS_X = 301

// CANONICAL "REVEAL FRAME" — { cx: 132, cy: 168, size: 168 } in the W=372
// viewBox. Every (emblem + constellation) unit is normalized to this single box
// (baked into the node coords + emblem wraps below) so the 4 reveals are the
// SAME size and sit in the SAME place — no jump when switching satellites. Each
// unit was scaled by 168 / (its larger bbox dimension) about its centre, then
// translated to (132,168), preserving the internal emblem↔stars fit. The right
// edge (x=216) clears the chain; the bottom (y=252) clears the annotation
// (top 70% ≈ y260). Spec from the uxui audit.

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedG = Animated.createAnimatedComponent(G)

const TWO_PI = Math.PI * 2

/** Deterministic 1-D PRNG — same seed → same star field every render. */
function rand(seed: number, i: number): number {
  const s = Math.sin(seed * 9301 + i * 49297) * 233280
  return s - Math.floor(s)
}

/** Background starfield — a sparse sprinkle so the eye reads
 *  "deep cosmic void", not "Milky Way". 44 candidates, ~34 survive the
 *  central skip-zone (was 70 — lowered for perf; they twinkle in shared
 *  buckets, not one worklet per star). */
type Star = { x: number; y: number; r: number; op: number; phase: number; speed: number }
const STARS: readonly Star[] = Array.from({ length: 44 }, (_, i) => {
  const x = rand(11, i) * W
  const y = rand(12, i) * W
  if (Math.hypot(x - CX, y - CY) < 60) return null
  return {
    x,
    y,
    r: 0.25 + rand(13, i) * 0.6,
    op: 0.25 + rand(14, i) * 0.45,
    phase: rand(15, i),
    // Per-star speed multiplier so the field doesn't twinkle in unison
    // (uniform shimmer is what makes a starfield read flat/static).
    speed: 0.7 + rand(16, i) * 0.6,
  } as Star
}).filter((s): s is Star => s !== null)

/** Deep starfield — distant pinpoints painted ON the cosmic backdrop
 *  (below the foreground twinkling stars). Tinier + dimmer + static —
 *  the layer that pushes the visual horizon further away, Genshin-
 *  style. The base field skips a wide central zone; CENTRE_STARS
 *  re-seeds ~12 faint specks INTO the middle band so the empty centre
 *  reads as deep textured sky, not an erased layer. */
type DeepStar = { x: number; y: number; r: number; op: number }
const DEEP_STARS_BASE: readonly DeepStar[] = Array.from({ length: 44 }, (_, i) => {
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

/** Centre-band fill — ~16 faint stars spanning x∈[60,240] so the LEFT
 *  half + middle carry deep-sky grain instead of reading as flat magenta
 *  void (the chain pulled inward, so the left needs its own texture to
 *  feel like cosmos, not dead space). Dimmer than the base field so they
 *  whisper, not compete with the chain. */
const CENTRE_STARS: readonly DeepStar[] = Array.from({ length: 16 }, (_, i) => ({
  x: 60 + rand(41, i) * 180,
  y: 40 + rand(42, i) * 292,
  r: 0.14 + rand(43, i) * 0.3,
  op: 0.07 + rand(44, i) * 0.16,
}))

const DEEP_STARS: readonly DeepStar[] = [...DEEP_STARS_BASE, ...CENTRE_STARS]

// Foreground stars split into a few buckets that share ONE twinkle worklet
// each (instead of one useAnimatedProps per star — ~34 worklets committing SVG
// props every frame was a top perf cost). Each bucket pulses at a slightly
// different phase so the field still doesn't shimmer in unison.
const STAR_BUCKET_COUNT = 5
const STAR_BUCKETS: readonly (readonly Star[])[] = Array.from(
  { length: STAR_BUCKET_COUNT },
  (_, b) => STARS.filter((_, i) => i % STAR_BUCKET_COUNT === b),
)

/** Cosmic dust — a few large, very faint motes (not stars) that drift
 *  diagonally over the fog, biased to the left half (over the nebula
 *  mass), giving the etherial "particles in suspension" depth of Genshin
 *  without any figure. Animated as ONE drifting group (cheap). */
const DUST: readonly { x: number; y: number; r: number; op: number }[] = Array.from(
  { length: 7 },
  (_, i) => ({
    x: 30 + rand(51, i) * 170,
    y: 60 + rand(52, i) * 260,
    r: 1.2 + rand(53, i) * 1.6,
    op: 0.04 + rand(54, i) * 0.06,
  }),
)

/** Art-only palette for the Mes hero. These colours don't belong in
 *  `theme/colors.ts` because they're scene-specific (nebula tints,
 *  star core whites, halo/aura pinks + violets that read against a
 *  near-black sky). Centralised here so the cosmos has a single
 *  source of truth and tweaking the mood is a one-block edit. */
const SKY = {
  // Nebula radial-gradient clouds painted off the chain axis.
  nebulaPurple: '#4A1545',
  nebulaMagenta: '#5C1838',
  nebulaDark: '#3A0C28',
  nebulaDeep: '#2C0A1F',
  // Halo + aura pinks/violets — generic fallback tints.
  haloPeach: '#F4ABC8',
  haloPeachWarm: '#FFCDA8',
  haloViolet: '#A48BC8',
  auraPink: '#FBD7E3',
  auraPale: '#FCE5EE',
  // Rising — warm gold tending amber (momentum).
  haloRisingGold: '#F2C879',
  auraRisingGold: '#FBE3B8',
  auraVioletPale: '#C9B5D8',
  // Bright star / pin core.
  starCore: '#FFFFFF',
} as const

/** Off-centre nebula clouds — soft radial gradients painted on the
 *  cosmic backdrop. Now LEFT-WEIGHTED: the cosmos reads as "fog on
 *  the left (weight without detail), nitid chain on the right". The
 *  right-hand cloud that competed with the chain is pushed down to a
 *  faint counterweight; a single denser mass anchors the left. */
const NEBULA_CLOUDS: readonly {
  cx: number
  cy: number
  r: number
  color: string
  opacity: number
}[] = [
  // Left anchor — split into two OFFSET lobes (instead of one flat disc)
  // so the fog reads as a nebula with volume, not a wash. They breathe
  // out of phase (NebulaCloud keys drift off idx).
  { cx: 64, cy: 128, r: 122, color: SKY.nebulaPurple, opacity: 0.34 },
  { cx: 96, cy: 212, r: 106, color: SKY.nebulaPurple, opacity: 0.22 },
  { cx: 58, cy: 300, r: 116, color: SKY.nebulaDeep, opacity: 0.2 },
  // Right — faded so it no longer fights the chain.
  { cx: 284, cy: 248, r: 142, color: SKY.nebulaMagenta, opacity: 0.18 },
  { cx: 312, cy: 76, r: 100, color: SKY.nebulaDark, opacity: 0.16 },
]

/** Bright pin-point nodes scattered on the (now-implicit) orbital
 *  field — simple "bright spots where the orbit shines". All
 *  positions sit clear of the chain column so they're visible on the
 *  cosmic background, not buried under the satellites. */
const NODES: readonly { x: number; y: number; size: number }[] = [
  { x: 332, y: 168, size: 1.1 }, // far-right (3 o'clock)
  { x: 40, y: 205, size: 1.05 }, // far-left (9 o'clock)
  { x: 305, y: 92, size: 0.95 }, // upper-right (2 o'clock)
  { x: 70, y: 268, size: 1 }, // lower-left (8 o'clock)
  { x: 232, y: 322, size: 0.95 }, // lower-right (5 o'clock)
  { x: 140, y: 50, size: 0.85 }, // upper-left (11 o'clock, small)
]

/** Pattern-chain positions — a "(" arc on the right-CENTRE of the canvas:
 *  the ends bow right, the middle bows left, so the chain reads as a curved
 *  parenthesis whose concavity CRADLES the cosmos (opens toward the empty
 *  left, turning negative space intentional). The frame + cardinal spikes
 *  overscan to ~r+28.5, so with the ends at x=300 the talisman edge lands at
 *  ~328 — ~44px of breathing room before the W=372 edge + vignette, no clip.
 *  Y∈[70,312] keeps the top/bottom medallions inside the vignette too. The
 *  left-most (middle) at x=262 stays clear of the reveal constellation. */
const SAT_POS: readonly { x: number; y: number }[] = [
  { x: 322, y: 78 },
  { x: 300, y: 152 },
  { x: 300, y: 228 },
  { x: 322, y: 302 },
]

/** Constellation spine — a smooth asymmetric Bézier threading the
 *  CENTRES of the four chain nodes. Built once from SAT_POS since the
 *  positions are static. Uses a cubic to the 2nd node then smooth (S)
 *  cubics through the rest so the curve flows as one gesture rather
 *  than four disconnected segments. Control points lean LEFT of the
 *  column so the thread bows into the cosmos (asymmetric, hand-drawn
 *  feel) instead of being a straight rail. */
const SPINE_D = (() => {
  const p = SAT_POS
  if (p.length < 2) return ''
  // First cubic: p0 → p1, control points bowing left of the column.
  const c0x = p[0]!.x - 22
  const c0y = p[0]!.y + 28
  const c1x = p[1]!.x - 20
  const c1y = p[1]!.y - 24
  let d = `M ${p[0]!.x} ${p[0]!.y} C ${c0x} ${c0y} ${c1x} ${c1y} ${p[1]!.x} ${p[1]!.y}`
  // Smooth cubics through the remaining nodes — reflected control
  // points keep tangents continuous; the explicit control bows left.
  for (let i = 2; i < p.length; i++) {
    const cx = p[i]!.x - 18
    const cy = p[i]!.y - 22
    d += ` S ${cx} ${cy} ${p[i]!.x} ${p[i]!.y}`
  }
  return d
})()

/* A single background star — twinkles asynchronously via its
 * `phase`. Bright at the peak of its wave, ~40 % of base at the
 * trough. */
/* One bucket of foreground stars sharing a SINGLE twinkle worklet (group
 * opacity wave), phased by `index`. Static (no worklet) under reduced motion. */
function MonthStarBucket({
  stars,
  index,
  clock,
  reduced,
}: {
  stars: readonly Star[]
  index: number
  clock: SharedValue<number>
  reduced: boolean
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((clock.value * 1.1 + index / STAR_BUCKET_COUNT) * 2 * Math.PI)
    return { opacity: 0.45 + 0.55 * wave }
  })
  const body = stars.map((s, i) => (
    <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={SKY.starCore} opacity={s.op} />
  ))
  if (reduced) return <G>{body}</G>
  return <AnimatedG animatedProps={animatedProps}>{body}</AnimatedG>
}

/* A nebula cloud that BREATHES — opacity ±22 % and scale ±4 % on a slow
 * loop, phased per cloud so the fog never pulses in unison. Anchored to its
 * own centre so it inflates/deflates in place. This slow swell is ~70 % of
 * the "living sky" feel. Static (base opacity) under reduced motion. */
function NebulaCloud({
  cloud,
  idx,
  clock,
  reduced,
}: {
  cloud: (typeof NEBULA_CLOUDS)[number]
  idx: number
  clock: SharedValue<number>
  reduced: boolean
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    if (reduced) return { opacity: 1, transform: [{ scale: 1 }] }
    const wave = 0.5 + 0.5 * Math.sin((clock.value + idx * 0.27) * TWO_PI)
    return {
      opacity: 0.78 + 0.22 * wave,
      transform: [
        { translateX: cloud.cx },
        { translateY: cloud.cy },
        { scale: 1 + 0.04 * wave },
        { translateX: -cloud.cx },
        { translateY: -cloud.cy },
      ],
    }
  })
  return (
    <AnimatedCircle
      cx={cloud.cx}
      cy={cloud.cy}
      r={cloud.r}
      fill={`url(#cloud-${idx})`}
      animatedProps={animatedProps}
    />
  )
}

/* The dust field — drifts diagonally as one group on a continuous loop,
 * fading in/out at the loop extremes so the reset never snaps visibly. */
function DustField({ clock, reduced }: { clock: SharedValue<number>; reduced: boolean }) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    if (reduced) return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }] }
    const t = clock.value
    const fade = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI)
    return {
      opacity: 0.7 * fade,
      transform: [{ translateX: t * 18 }, { translateY: -t * 10 }],
    }
  })
  return (
    <AnimatedG animatedProps={animatedProps}>
      {DUST.map((d, i) => (
        <Circle key={`dust-${i}`} cx={d.x} cy={d.y} r={d.r} fill={SKY.auraPale} opacity={d.op} />
      ))}
    </AnimatedG>
  )
}

/* An OCCASIONAL shooting star — a short streak that crosses the upper area
 * every ~15 s (long pauses, brief pass), the "alive" sparkle of a Genshin
 * sky. One only, never a meteor shower. Off under reduced motion. */
const SHOOT_A = { x: 286, y: 28 }
const SHOOT_B = { x: 196, y: 92 }
function ShootingStar({ reduced, screenActive }: { reduced: boolean; screenActive: boolean }) {
  const p = useSharedValue(0)
  useEffect(() => {
    if (reduced || !screenActive) return
    p.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 5000 }), // initial wait (invisible at t=0)
        withTiming(1, { duration: 850, easing: Easing.in(Easing.quad) }), // the streak
        withDelay(9000, withTiming(0, { duration: 0 })), // hold off-screen, snap back
      ),
      -1,
      false,
    )
    return () => cancelAnimation(p)
  }, [reduced, screenActive, p])
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const t = p.value
    const visible = t > 0.01 && t < 0.99 ? 1 : 0
    const fade = Math.sin(t * Math.PI)
    return {
      opacity: 0.55 * fade * visible,
      transform: [
        { translateX: SHOOT_A.x + (SHOOT_B.x - SHOOT_A.x) * t },
        { translateY: SHOOT_A.y + (SHOOT_B.y - SHOOT_A.y) * t },
      ],
    }
  })
  return (
    <AnimatedG animatedProps={animatedProps}>
      {/* Streak drawn pointing back along the travel direction. */}
      <Line
        x1={21}
        y1={-15}
        x2={0}
        y2={0}
        stroke={SKY.auraPale}
        strokeWidth={1.1}
        strokeLinecap="round"
        opacity={0.5}
      />
      <Circle cx={0} cy={0} r={1.4} fill={SKY.starCore} />
    </AnimatedG>
  )
}

/* A bright pin-point node — bloom + glow + nucleus stack. No tail;
 * clean static bright spots that mark "this orbit has activity"
 * without competing with the chain. */
function NodePoint({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={3.5 * size} fill={SKY.auraPink} opacity={0.25} />
      <Circle cx={x} cy={y} r={2.2 * size} fill={SKY.auraPale} opacity={0.55} />
      <Circle cx={x} cy={y} r={1.1 * size} fill={SKY.starCore} />
    </G>
  )
}

/** Polar → cartesian, 12-o'clock origin (ang 0 = top). Used to lay out
 *  the SatFrame's gear teeth + cardinal ornaments around the medallion. */
function pol(cx: number, cy: number, rr: number, ang: number) {
  const a = ((ang - 90) * Math.PI) / 180
  return { x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a) }
}

/* SatFrame — the ornamented "talent-node" talisman that rings the
 * medallion: a beveled outer ring, a highlight bevel, 16 gear teeth
 * (skipping the four cardinals), four cardinal spikes (compass/jewel
 * read), and a thin inner ring. Gold/amber is the resting "fire"; the
 * single active node IGNITES — same gold hue lifted to its brightest
 * cream (oroLight / oroLeche / white bevel), NO magenta. Fully STATIC. */
function SatFrame({ cx, cy, r, active }: { cx: number; cy: number; r: number; active?: boolean }) {
  // Active = "ignited gold": same family as rest, pushed up in luminance
  // (metal → oroLight, soft → oroLeche, bevel → pure white) so it reads as
  // lit, not as a different colour. No magenta on the node.
  const metal = active ? colors.oroLight : colors.oro
  const metalSoft = active ? colors.oroLeche : colors.oroSoft
  const bevel = active ? '#FFFFFF' : colors.oroLight

  // Gear teeth → INSTRUMENT GRADUATION. The old radial teeth read as a
  // machine gear (dashboard sci-fi); a graduated dial (long cardinal marks +
  // short minor marks, hair-thin) reads as a sextant/astrolabe face — the
  // "intimate observatory" the brief wants. Whispered at rest (0.22) so the
  // ring is essentially clean; it lights up (0.9) only when the node ignites.
  const TICKS = 12
  const ticks: React.ReactElement[] = []
  for (let k = 0; k < TICKS; k++) {
    const ang = (360 / TICKS) * k
    const isCardinal = ang % 90 === 0
    if (isCardinal && active) continue // the spike replaces the cardinal mark when lit
    const inner = r + 3.2
    const outer = isCardinal ? r + 7.4 : r + 5.4
    const a = pol(cx, cy, inner, ang)
    const b = pol(cx, cy, outer, ang)
    ticks.push(
      <Line
        key={`tick-${k}`}
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={metalSoft}
        strokeWidth={isCardinal ? 0.8 : 0.6}
        strokeOpacity={active ? 0.9 : 0.22}
        strokeLinecap="round"
      />,
    )
  }

  // Cardinal spikes are reserved for the ACTIVE node — at rest the talisman
  // is a clean ring + faint teeth ("the quietude is the luxury"); igniting a
  // body grows its four compass spikes, giving the selection real contrast.
  const spikes = active
    ? [0, 90, 180, 270].map((ang) => {
        const tip = pol(cx, cy, r + 8.6, ang)
        const base = pol(cx, cy, r + 3.8, ang)
        const wl = pol(cx, cy, r + 5.7, ang - 7)
        const wr = pol(cx, cy, r + 5.7, ang + 7)
        return (
          <Path
            key={`spike-${ang}`}
            d={`M ${tip.x} ${tip.y} L ${wr.x} ${wr.y} L ${base.x} ${base.y} L ${wl.x} ${wl.y} Z`}
            fill={metalSoft}
            fillOpacity={1}
          />
        )
      })
    : null

  return (
    <G>
      {/* Beveled outer ring — the talisman's metal edge. Thicker when
          ignited (1.7) so the lit node has a heftier rim. */}
      <Circle
        cx={cx}
        cy={cy}
        r={r + 3.4}
        fill="none"
        stroke={metal}
        strokeWidth={active ? 1.7 : 1.4}
      />
      {/* Highlight bevel — the polished catch-light. ACTIVE-ONLY now: at rest
          the talisman is just outer ring + inner ring + faint graduation (one
          concentric line fewer = quieter dial); igniting adds the catch-light. */}
      {active ? (
        <Circle cx={cx} cy={cy} r={r + 2.4} fill="none" stroke={bevel} strokeWidth={0.5} />
      ) : null}
      {/* Graduation marks — long cardinals + short minors (instrument dial). */}
      {ticks}
      {/* 4 cardinal spikes — compass read, ACTIVE only. */}
      {spikes}
      {/* Thin inner ring hugging the medallion field. */}
      <Circle
        cx={cx}
        cy={cy}
        r={r + 0.6}
        fill="none"
        stroke={bevel}
        strokeWidth={0.6}
        strokeOpacity={active ? 1 : 0.55}
      />
    </G>
  )
}

/* ActiveAura — the breathing + igniting aura of the single ACTIVE node.
 * Mounted ONLY for the active satellite, so its Reanimated hooks always
 * run (no conditional hooks). Two shared clocks drive it:
 *   · `breath` — a yo-yo 0→1 clock (3.2 s, ease-in-out) that modulates
 *     the aura opacity (±15 % of base) and radius (±6 % of auraR).
 *   · `ignite` — a one-shot 0→1→0 flash fired on mount (i.e. when the
 *     node becomes active), adding +0.25 opacity / +12 % r on top.
 * Cream gradient (oroLeche → oroLight → oroSoft) — same family as rest,
 * just lit. The non-active auras render as a plain static Circle. */
function ActiveAura({
  x,
  y,
  auraR,
  baseOpacity,
  gid,
}: {
  x: number
  y: number
  auraR: number
  /** The Stop-0 opacity at rest (the static aura's centre opacity). */
  baseOpacity: number
  gid: string
}) {
  const breath = useSharedValue(0)
  const ignite = useSharedValue(0)
  // Gate the breath loop off-tab — otherwise this active node keeps repainting
  // the MonthSky <Svg> forever if you leave Mes with a pattern selected.
  const screenActive = useScreenActive()

  // Ignition flash — fires once when this node becomes active (on mount).
  useEffect(() => {
    ignite.value = withSequence(withTiming(1, { duration: 180 }), withTiming(0, { duration: 520 }))
    return () => cancelAnimation(ignite)
  }, [ignite])

  // Breathing yo-yo — gentle, organic; paused when the tab isn't focused.
  useEffect(() => {
    if (!screenActive) {
      cancelAnimation(breath)
      return
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [breath, screenActive])

  const animatedProps = useAnimatedProps(() => {
    'worklet'
    // breath ∈ [0,1] → signed wave ∈ [-1,1] for symmetric ±modulation.
    const wave = Math.sin(breath.value * TWO_PI)
    const op = baseOpacity * (1 + 0.15 * wave) + ignite.value * 0.25
    const r = auraR * (1 + 0.06 * wave) + auraR * 0.12 * ignite.value
    return { opacity: op, r }
  })

  return <AnimatedCircle cx={x} cy={y} fill={`url(#aura-${gid})`} animatedProps={animatedProps} />
}

/* ActiveCore — the inner warm-white core of the ACTIVE node, a soft
 * white-cream disc between the field and the catch-light arc. Pulses
 * 0.06→0.14, DESYNCED from the aura (phase-offset by π) so the breath
 * reads organic, not metronomic. Radius is fixed. Mounted only for the
 * active node; non-active nodes get a static low-opacity Circle. */
function ActiveCore({ x, y, r }: { x: number; y: number; r: number }) {
  const breath = useSharedValue(0)
  const screenActive = useScreenActive()

  useEffect(() => {
    if (!screenActive) {
      cancelAnimation(breath)
      return
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [breath, screenActive])

  const animatedProps = useAnimatedProps(() => {
    'worklet'
    // Phase-offset by π so the core peaks while the aura troughs.
    const wave = 0.5 + 0.5 * Math.sin(breath.value * TWO_PI + Math.PI)
    return { opacity: 0.06 + 0.08 * wave }
  })

  return <AnimatedCircle cx={x} cy={y} r={r} fill="#FFF6E5" animatedProps={animatedProps} />
}

/* A satellite's SVG layer — the ornamented "talent node": a gold (or
 * ignited-cream when active) aura, a polished dark medallion field, a
 * soft top catch-light arc, and the SatFrame talisman. The orbit-art
 * glyph still rides on top in the RN overlay (`PatternChainIcon`). Only
 * the ACTIVE node animates (aura breathes, inner core pulses, ignition
 * flash on tap); the rest are STATIC — the stillness is the luxury. */
function SatBody({
  x,
  y,
  active,
  gid,
}: {
  x: number
  y: number
  active?: boolean
  /** Unique suffix for this body's inline gradients. */
  gid: string
}) {
  // Active aura is bigger (2.15×) + cream; rest stays at 1.5× gold.
  const auraR = MEDALLION_R * (active ? 2.15 : 1.5)
  // Cream ignition gradient for the active node — same gold family, lit.
  const aura1 = active ? colors.oroLeche : SKY.auraRisingGold
  const aura2 = active ? colors.oroLight : SKY.haloRisingGold
  const aura3 = active ? colors.oroSoft : SKY.haloRisingGold
  // Stop-0 opacity used as the breathing base for the active aura.
  const auraBaseOp = active ? 0.62 : 0.42
  return (
    <G>
      {/* Per-body inline gradients in USER SPACE — anchored at this
          satellite's real (x,y). objectBoundingBox gradients reused across
          many circles render as a square in react-native-svg; userSpaceOnUse
          keeps the glow a true round fade that blends into the cosmos. */}
      <Defs>
        <RadialGradient id={`aura-${gid}`} cx={x} cy={y} r={auraR} gradientUnits="userSpaceOnUse">
          {active
            ? [
                <Stop key="0" offset="0" stopColor={aura1} stopOpacity={0.62} />,
                <Stop key="1" offset="0.32" stopColor={aura2} stopOpacity={0.34} />,
                <Stop key="2" offset="0.55" stopColor={aura3} stopOpacity={0.16} />,
                <Stop key="3" offset="1" stopColor={aura3} stopOpacity={0} />,
              ]
            : [
                <Stop key="0" offset="0" stopColor={aura1} stopOpacity={0.42} />,
                <Stop key="1" offset="0.45" stopColor={aura2} stopOpacity={0.18} />,
                <Stop key="2" offset="1" stopColor={aura2} stopOpacity={0} />,
              ]}
        </RadialGradient>
        <RadialGradient
          id={`field-${gid}`}
          cx={x}
          cy={y - MEDALLION_R * 0.16}
          r={MEDALLION_R}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor="#2A1419" />
          <Stop offset="0.6" stopColor={colors.bgCard2} />
          <Stop offset="1" stopColor="#120609" />
        </RadialGradient>
      </Defs>
      {/* Aura — soft round glow. STATIC gold at rest; the ACTIVE node
          uses ActiveAura (breathing + ignition flash). Only one of the
          two branches mounts per body, but ActiveAura's hooks always run
          when it's the active node, so no conditional-hook hazard. */}
      {active ? (
        <ActiveAura x={x} y={y} auraR={auraR} baseOpacity={auraBaseOp} gid={gid} />
      ) : (
        <Circle cx={x} cy={y} r={auraR} fill={`url(#aura-${gid})`} />
      )}
      {/* Medallion field — a polished dark disc with a warm centre. */}
      <Circle cx={x} cy={y} r={MEDALLION_R} fill={`url(#field-${gid})`} />
      {/* Inner warm-white core — only on the ACTIVE node. Pulses,
          desynced from the aura (ActiveCore). Sits between field and
          catch-light arc. */}
      {active ? <ActiveCore x={x} y={y} r={MEDALLION_R * 0.5} /> : null}
      {/* Top catch-light arc — a faint highlight sweeping the upper rim. */}
      <Path
        d={`M ${x - MEDALLION_R * 0.62} ${y - MEDALLION_R * 0.34} A ${MEDALLION_R * 0.78} ${
          MEDALLION_R * 0.78
        } 0 0 1 ${x + MEDALLION_R * 0.62} ${y - MEDALLION_R * 0.34}`}
        fill="none"
        stroke={active ? '#FFFFFF' : colors.oroLight}
        strokeWidth={0.6}
        strokeOpacity={active ? 0.55 : 0.22}
        strokeLinecap="round"
      />
      {/* Ornamented talisman frame. */}
      <SatFrame cx={x} cy={y} r={MEDALLION_R} active={active} />
    </G>
  )
}

// Chain badge geometry. The glyph box (ICON_PCT, a % of the square canvas)
// and the container medallion (MEDALLION_R) are now DECOUPLED: the glyph can
// grow to fill more of the medallion without enlarging the container circle
// or its frame (per the owner's ask — bigger icons, same-size container).
const ICON_PCT = 23
// Container circle / frame radius — kept at the prior size (was ICON_R*0.62
// at ICON_PCT 17.5) so growing ICON_PCT enlarges only the glyph.
const MEDALLION_R = (((17.5 / 100) * W) / 2) * 0.62

/* Pattern glyph art — the orbit-art glyph drawn by `kind`:
 *   peak      → shine   (gold star / brilliance, high energy)
 *   valley    → rest    (low energy, quiet)
 *   stable    → anchor  (steady)
 *   tentative → reticle (telescope crosshair — "in observation")
 *   rising    → shine   (fallback — momentum, no dedicated art yet)
 *
 * ONE régime for all four: `currentColor` gold silhouettes (shine/rest/anchor
 * via their `-tint` variants) and an inline reticle for tentative — so the
 * chain reads as a single family, brighter (`oroLeche`) on the active node,
 * soft (`oroLight`) at rest. (The old code drew rest/anchor/watch as
 * multi-colour amber AS-IS while only shine was tinted → 3 glyphs spoke a
 * different language and turned to blobs when dimmed.) The viewBoxes differ a
 * lot, so we fix width/height and let `meet` centre + scale each one. */
function PatternArt({ kind, active }: { kind: SatelliteKind | undefined; active?: boolean }) {
  // Fill the badge wrapper (which is sized to the glow); the wrapper, not
  // a fixed px, controls the size so the art tracks the halo on any screen.
  const common = {
    width: '100%',
    height: '100%',
    preserveAspectRatio: 'xMidYMid meet',
  } as const
  const ink = active ? colors.oroLeche : colors.oroLight
  switch (kind) {
    case 'peak':
    case 'rising':
      return <ShineArt {...common} color={ink} fill={ink} />
    case 'valley':
      return <RestArt {...common} color={ink} fill={ink} />
    case 'stable':
      return <AnchorArt {...common} color={ink} fill={ink} />
    case 'tentative':
      // Telescope reticle — a SMALL scope ring + crosshair + centre pip,
      // drawn inline. Critical: the medallion's own frame ring lands at
      // ~radius 23.6 in this viewBox (≈ spans 26–74), so the reticle ring is
      // kept well INSIDE it (r15 → spans 35–65). When the ring was r26 it sat
      // right on top of the frame, reading as a bold double gold ring = looked
      // permanently SELECTED at rest. Small + thin now → a calm scope like the
      // other glyphs, clear of the frame.
      return (
        <Svg {...common} viewBox="0 0 100 100">
          <Circle cx={50} cy={50} r={15} fill="none" stroke={ink} strokeWidth={2} />
          <Line
            x1={50}
            y1={30}
            x2={50}
            y2={70}
            stroke={ink}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <Line
            x1={30}
            y1={50}
            x2={70}
            y2={50}
            stroke={ink}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <Circle cx={50} cy={50} r={3} fill={ink} />
        </Svg>
      )
    default:
      return null
  }
}

/* The pattern glyph — an RN View overlaying the canvas at the chain
 * item position. The visual core is the orbit-art illustration drawn
 * by `kind`. The body is STATIC now (no breath); the only motion left
 * here is the optional `affordance` "tap me" pulse on the first chain
 * item before the user has interacted, so the chain is discoverable. */
function PatternChainIcon({
  pos,
  kind,
  clock,
  dimmed,
  active,
  affordance,
  phase = 0,
}: {
  pos: { x: number; y: number }
  kind: SatelliteKind | undefined
  /** Drives only the affordance "tap me" pulse (twinkle clock). The
   *  satellite itself no longer breathes. */
  clock: SharedValue<number>
  dimmed?: boolean
  active?: boolean
  affordance?: boolean
  /** Stagger offset so the four medallions don't pulse in unison. */
  phase?: number
}) {
  const isTentative = kind === 'tentative'
  const animatedStyle = useAnimatedStyle(() => {
    'worklet'
    // Affordance pulse: a gentle, staggered scale boost across the chain
    // that cues "tap me" without a text label. Static (scale 1) once a
    // satellite is selected.
    if (!affordance) return { transform: [{ scale: 1 }] }
    const cue = 0.5 + 0.5 * Math.sin((clock.value * 1.6 + phase) * 2 * Math.PI)
    // ±0.09 (was 0.055, imperceptible) — the chain now visibly breathes
    // "tap me". This is the only signal that the medallions are tappable,
    // and reaching the reveal is the whole point of the tab.
    return { transform: [{ scale: 1 + cue * 0.09 }] }
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
          // Inactive during a reveal → 0.30 (was 0.18, which read as a render
          // glitch, not a latent node). The tentative ×0.7 is NOT compounded
          // onto the dimmed floor (0.18×0.7 = 0.126 was invisible) — it only
          // softens the tentative node when it's the visible/active one.
          opacity: dimmed ? 0.3 : isTentative ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.chainIconDisc}>
        <PatternArt kind={kind} active={active} />
      </View>
    </Animated.View>
  )
}

// ── Skia constellation reveal ───────────────────────────────────────
// The headline reveal: when a satellite is tapped, the cosmos lights a
// CONSTELLATION on the left/centre — bloom-stars (ported almost verbatim
// from WeekConstellation's `WeekFlareNode`) joined by THICK glowing
// energy lines that draw-on + carry a travelling comet. Coloured by the
// satellite's dimension; cores stay white-cream. No zoom: each node maps
// its viewBox position to pixels via `k` and scales its drawing by `k`.

/** "#RRGGBB" → "r,g,b". Pure. Mirrors WeekConstellation's `wkRgb`. */
function monthRgb(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}
const MS_BG = monthRgb(colors.bg)

/** "Observatory tint": mix a dimension hex ~22 % toward gold so the six
 *  dimension colours share a warm substrate and none (warm magenta nor cold
 *  sage/indigo) clashes with the warm-dark field. Returns "#RRGGBB". */
/** Uniform "observatory ink" for the reveal emblems — every emblem (moon,
 *  shine, anchor, watch) is drawn in this single gold-cream at the same
 *  opacity, regardless of dimension. This is the homogenization spine: the
 *  emblem is the constant PAGE; colour lives only in the constellation. */
const EMBLEM_INK = colors.oroSoft
const EMBLEM_OPACITY = 0.5

function harmonizeDim(hex: string): string {
  // 0.50 (was 0.22) — pull every dimension HALFWAY to observatory gold so the
  // cool dimensions (sueño indigo, ciclo silver-blue) stop reading cold and
  // all four constellations sit in one warm family.
  const MIX = 0.5
  const a = parseInt(hex.replace('#', ''), 16)
  const g = parseInt(colors.oro.replace('#', ''), 16) // observatory gold
  const ch = (shift: number) => {
    const av = (a >> shift) & 255
    const gv = (g >> shift) & 255
    return Math.round(av + (gv - av) * MIX)
  }
  const r = ch(16)
  const gn = ch(8)
  const b = ch(0)
  return `#${((r << 16) | (gn << 8) | b).toString(16).padStart(6, '0')}`
}
// Line filament reads as light (cream), not a second gold thread — oro is
// reserved for the chain/chrome (homogenization: 2 protagonists + neutrals).
const MS_LECHE = monthRgb(colors.leche)

/* A single bloom star — ported almost verbatim from WeekConstellation's
 * `WeekFlareNode`. The magenta bloom is swapped for the per-dimension
 * rgb (`rgbHue`); the white core / blown core / starburst stay white-
 * cream ("colour por dimensión, núcleo blanco"). Two new bits vs Week:
 *   · `appear` — a 0→1 entrance scalar (driven by the layer's choreography)
 *     so the star blooms IN on reveal instead of being instantly present.
 *   · `settle` — a 0→1 scalar that, after the show, drops the bloom
 *     opacity ~40 % so the annotation text reads over a calm glow.
 * `reduced` honours reduce-motion (no breathing, final state only). */
function MonthBloomStar({
  vbX,
  vbY,
  hero,
  mag,
  k,
  t,
  phase,
  rgbHue,
  lit,
  frac,
  settle,
  reduced,
}: {
  vbX: number
  vbY: number
  hero: boolean
  /** Star magnitude 1 (brightest) … 4 (faint). Hero is treated as 1. */
  mag?: number
  k: number
  t: SharedValue<number>
  phase: number
  /** "r,g,b" of the dimension colour for the bloom aura. */
  rgbHue: string
  /** 0→1 traversal position of the painting light. */
  lit: SharedValue<number>
  /** This star's position along the route (0..1): it ignites when the
   *  light reaches it, so the figure is painted as the light recorre it. */
  frac: number
  /** 0→1 post-show settle scalar (drops bloom opacity when 1). */
  settle: SharedValue<number>
  reduced: boolean
}) {
  // Size scales smoothly by magnitude (1 bright … 4 faint) so the hero leads
  // without dwarfing the field — four steps of brightness, not a sun + specks.
  const MAG_SCALE = [1, 1, 0.78, 0.6, 0.45]
  const magScale = MAG_SCALE[hero ? 1 : (mag ?? 3)]!
  const b = hero ? 1 : 0.55 + 0.45 * magScale
  const R = (hero ? 5 : 3.2) * magScale + b * 1.8
  const m = hero ? 1 : 0.55 + b * 0.45
  // +FLARE_PAD because the Canvas is inset by -FLARE_PAD on every side
  // (overscan), so the diagram origin sits at (PAD, PAD) in canvas space.
  const transform = useDerivedValue(() => [
    { translateX: vbX * k + FLARE_PAD },
    { translateY: vbY * k + FLARE_PAD },
    { scale: k },
  ])
  // Entrance is SLAVED to the light: the star blooms in over a short window
  // once the light reaches its `frac` — so stars ignite one-by-one in the
  // light's wake, not all at once.
  const appear = useDerivedValue(() => Math.min(1, Math.max(0, (lit.value - frac) / 0.07)))
  // Entrance + breathing combined into one local scale.
  const breathe = useDerivedValue(() => {
    const inn = appear.value
    if (reduced) return [{ scale: inn }]
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    return [{ scale: inn * (0.93 + wave * 0.12) }]
  })
  // After the show settles, drop the whole node's bloom opacity ~40 %
  // (and fade in via `appear`) so the text reads over a calm glow. A subtle
  // TWINKLE rides on top — a per-star brightness shimmer (desynced by phase,
  // faster than the breath) so the lit stars sparkle like a real sky. Fainter
  // stars twinkle more, the hero least.
  const twAmp = hero ? 0.07 : 0.1 + ((mag ?? 2) - 1) * 0.03
  const groupOpacity = useDerivedValue(() => {
    const base = appear.value * (1 - settle.value * 0.42)
    if (reduced) return base
    const tw = 0.5 + 0.5 * Math.sin((t.value * 4.2 + phase * 5) * 2 * Math.PI)
    return base * (1 - twAmp + twAmp * tw)
  })
  const hueBloomR = R * (hero ? 6 : 5)
  const whiteBloomR = R * (hero ? 3 : 2.6)
  const spikeCount = hero ? 6 : 4
  const burst = Array.from({ length: spikeCount }, (_, i) => {
    const ang = (i * Math.PI * 2) / spikeCount + (((i * 37) % 7) - 3) * 0.03
    const long = i % 2 === 0
    return {
      ang,
      len: R * (long ? (hero ? 8 : 5) : hero ? 4 : 2.5),
      th: R * 0.22,
      op: (long ? 0.7 : 0.4) * m,
    }
  })
  const majors = hero
    ? [
        { ang: 0, len: R * 7, th: R * 0.36, op: 0.75 },
        { ang: Math.PI / 2, len: R * 6, th: R * 0.3, op: 0.62 },
      ]
    : [{ ang: 0, len: R * 5, th: R * 0.26, op: 0.4 }]
  const sparkles = hero
    ? [
        { x: R * 6, y: -R * 4, r: R * 0.45, op: 0.5 },
        { x: -R * 5, y: R * 5, r: R * 0.38, op: 0.42 },
      ]
    : []
  return (
    <SkiaGroup transform={transform} opacity={groupOpacity}>
      {/* 0 · knock back the backdrop so the flare reads bright. */}
      <SkiaCircle c={vec(0, 0)} r={R * 7}>
        <SkiaRadialGradient
          c={vec(0, 0)}
          r={R * 7}
          colors={[`rgba(${MS_BG},0.5)`, `rgba(${MS_BG},0.16)`, `rgba(${MS_BG},0)`]}
        />
      </SkiaCircle>
      {/* 1 · bloom — dimension aura + white core, respirating. */}
      <SkiaGroup blendMode="screen" transform={breathe}>
        <SkiaCircle c={vec(0, 0)} r={hueBloomR}>
          <SkiaRadialGradient
            c={vec(0, 0)}
            r={hueBloomR}
            colors={[
              `rgba(${rgbHue},${0.5 * m})`,
              `rgba(${rgbHue},${0.16 * m})`,
              `rgba(${rgbHue},0)`,
            ]}
          />
          <BlurMask blur={R * 4} style="normal" />
        </SkiaCircle>
        <SkiaCircle c={vec(0, 0)} r={whiteBloomR}>
          <SkiaRadialGradient
            c={vec(0, 0)}
            r={whiteBloomR}
            colors={[
              `rgba(255,255,255,${0.4 * m})`,
              `rgba(255,255,255,${0.1 * m})`,
              'rgba(255,255,255,0)',
            ]}
          />
          <BlurMask blur={R * 2} style="normal" />
        </SkiaCircle>
      </SkiaGroup>
      {/* 2 · fine starburst + dominant cross. */}
      <SkiaGroup blendMode="plus">
        {[...burst, ...majors].map((r, i) => (
          <SkiaGroup key={`ray-${i}`} transform={[{ rotate: r.ang }]}>
            <SkiaRect x={-r.len} y={-r.th / 2} width={r.len * 2} height={r.th}>
              <SkiaLinearGradient
                start={vec(-r.len, 0)}
                end={vec(r.len, 0)}
                colors={['rgba(255,255,255,0)', `rgba(255,255,255,${r.op})`, 'rgba(255,255,255,0)']}
                positions={[0, 0.5, 1]}
              />
              <BlurMask blur={Math.max(0.4, r.th * 0.45)} style="normal" />
            </SkiaRect>
          </SkiaGroup>
        ))}
      </SkiaGroup>
      {/* 3 · blown white core. */}
      <SkiaGroup blendMode="plus">
        <SkiaCircle c={vec(0, 0)} r={R * 2}>
          <SkiaRadialGradient
            c={vec(0, 0)}
            r={R * 2}
            colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.25)', 'rgba(255,255,255,0)']}
          />
          <BlurMask blur={R} style="normal" />
        </SkiaCircle>
        <SkiaCircle c={vec(0, 0)} r={R * 0.8} color="white">
          <BlurMask blur={R * 0.25} style="normal" />
        </SkiaCircle>
      </SkiaGroup>
      {/* 4 · sparkles (hero only). */}
      {sparkles.length > 0 ? (
        <SkiaGroup blendMode="plus">
          {sparkles.map((s, i) => (
            <SkiaCircle
              key={`sp-${i}`}
              c={vec(s.x, s.y)}
              r={s.r}
              color={`rgba(255,255,255,${s.op})`}
            />
          ))}
        </SkiaGroup>
      ) : null}
    </SkiaGroup>
  )
}

/* A single energy line — the headline: a THICK glowing line that energy
 * flows through. Three Skia layers, all in canvas px (vb*k + FLARE_PAD):
 *   · Body    — wide, soft, dimension-tinted, screen blend.
 *   · Filament— thin bright cream core, plus blend.
 *   · Comet   — a travelling bright bloom that runs the line outward
 *               from the hero-end.
 * The body + filament DRAW ON from the source (hero) end via the Path
 * `start`/`end` trim props, staggered by `idx`. `dashed` (the tentative
 * hypothesis link) renders fainter with no comet — "aún en observación".
 *
 * Source/target are pre-oriented by the layer so (sx,sy) is the endpoint
 * nearest the hero: the draw-on + comet always travel OUTWARD. */
function EnergyLine({
  sx,
  sy,
  tx,
  ty,
  k,
  rgbHue,
  lit,
  sFrac,
  eFrac,
  settle,
  dashed,
}: {
  sx: number
  sy: number
  tx: number
  ty: number
  k: number
  rgbHue: string
  /** 0→1 traversal position of the painting light. */
  lit: SharedValue<number>
  /** Route fractions at which this line starts/finishes drawing — so it
   *  draws exactly as the light crosses it (source→target). */
  sFrac: number
  eFrac: number
  /** 0→1 post-show settle scalar (drops line opacity when 1). */
  settle: SharedValue<number>
  dashed?: boolean
}) {
  // Canvas-space endpoints. Source = the end the light reaches first.
  const x1 = sx * k + FLARE_PAD
  const y1 = sy * k + FLARE_PAD
  const x2 = tx * k + FLARE_PAD
  const y2 = ty * k + FLARE_PAD
  const path = `M ${x1} ${y1} L ${x2} ${y2}`

  // Weight by length: short edges (tight clusters) draw thinner so the
  // figure reads as a constellation, not uniform cords crossing the void.
  const lenVb = Math.hypot(sx - tx, sy - ty)
  const wFactor = Math.max(0.5, Math.min(1, lenVb / 70))

  // The line trims open (end 0→1) as the light crosses from sFrac to eFrac —
  // drawn in the light's wake, not all at once.
  const span = Math.max(0.0001, eFrac - sFrac)
  const end = useDerivedValue(() => Math.min(1, Math.max(0, (lit.value - sFrac) / span)))
  // Body + filament opacities fall ~38–45 % once the show settles.
  const bodyOpacity = useDerivedValue(() => (dashed ? 0.22 : 0.5) * (1 - settle.value * 0.4))
  const filamentOpacity = useDerivedValue(() => 0.9 * (1 - settle.value * 0.45))

  return (
    <SkiaGroup>
      {/* Body — wide soft dimension-tinted glow, screen blend. */}
      <SkiaGroup blendMode="screen" opacity={bodyOpacity}>
        <SkiaPath
          path={path}
          start={0}
          end={end}
          style="stroke"
          strokeWidth={3.5 * k * wFactor}
          strokeCap="round"
          color={`rgb(${rgbHue})`}
        >
          <BlurMask blur={6 * k} style="normal" />
        </SkiaPath>
      </SkiaGroup>
      {/* Filament — thin bright cream core, plus blend. Dashed link gets
          a lighter filament too (still draws, just fainter overall). */}
      <SkiaGroup blendMode="plus" opacity={filamentOpacity}>
        <SkiaPath
          path={path}
          start={0}
          end={end}
          style="stroke"
          strokeWidth={1.2 * k * Math.max(0.6, wFactor)}
          strokeCap="round"
          color={`rgba(${MS_LECHE},0.85)`}
        >
          <BlurMask blur={1 * k} style="normal" />
        </SkiaPath>
      </SkiaGroup>
    </SkiaGroup>
  )
}

/** Place a point at fraction `p` (0..1) along a polyline given as canvas-px
 *  waypoint arrays + cumulative segment lengths. Worklet — used by the
 *  continuous energy current to ride the whole constellation route. */
function posAlongRoute(
  p: number,
  wx: readonly number[],
  wy: readonly number[],
  cum: readonly number[],
  total: number,
): { x: number; y: number } {
  'worklet'
  const d = p * total
  let seg = 0
  while (seg < cum.length - 2 && d > cum[seg + 1]!) seg++
  const segLen = cum[seg + 1]! - cum[seg]!
  const f = segLen > 0 ? (d - cum[seg]!) / segLen : 0
  return {
    x: wx[seg]! + (wx[seg + 1]! - wx[seg]!) * f,
    y: wy[seg]! + (wy[seg + 1]! - wy[seg]!) * f,
  }
}

/* EnergyCurrent — the bright HEAD of light that travels the route while it
 * PAINTS the constellation: it rides `lit` (0→1, the traversal position), so
 * nodes + lines ignite in its wake (see MonthBloomStar / EnergyLine, which
 * key their own appear/draw off the same `lit`). Drags a dimension-tinted
 * tail; fades out as `settle` rises once the figure is fully drawn. */
function EnergyCurrent({
  wpX,
  wpY,
  cumLen,
  totalLen,
  rgbHue,
  k,
  lit,
  settle,
}: {
  wpX: readonly number[]
  wpY: readonly number[]
  cumLen: readonly number[]
  totalLen: number
  rgbHue: string
  k: number
  lit: SharedValue<number>
  settle: SharedValue<number>
}) {
  // A touch bigger (3.8→4.6) so the travelling light reads clearly as the
  // thing DRAWING the constellation, now that the trace is slow enough to watch.
  const headR = Math.max(3, 4.6 * k)
  const head = useDerivedValue(() => {
    const p = posAlongRoute(lit.value, wpX, wpY, cumLen, totalLen)
    return vec(p.x, p.y)
  })
  const w1 = useDerivedValue(() => {
    const p = posAlongRoute(Math.max(0, lit.value - 0.05), wpX, wpY, cumLen, totalLen)
    return vec(p.x, p.y)
  })
  const w2 = useDerivedValue(() => {
    const p = posAlongRoute(Math.max(0, lit.value - 0.1), wpX, wpY, cumLen, totalLen)
    return vec(p.x, p.y)
  })
  const w3 = useDerivedValue(() => {
    const p = posAlongRoute(Math.max(0, lit.value - 0.16), wpX, wpY, cumLen, totalLen)
    return vec(p.x, p.y)
  })
  // Visible while the light travels (lit ∈ (0,1)); fades as settle rises and
  // vanishes once it parks at the route end.
  const opacity = useDerivedValue(() => {
    const travelling = lit.value > 0.005 && lit.value < 0.995 ? 1 : 0
    return travelling * (1 - settle.value)
  })

  return (
    <SkiaGroup blendMode="plus" opacity={opacity}>
      {/* Wake — colored puffs lagging the head, fading back. */}
      <SkiaCircle c={w3} r={headR * 1.5} color={`rgba(${rgbHue},0.22)`}>
        <BlurMask blur={headR * 1.5} style="normal" />
      </SkiaCircle>
      <SkiaCircle c={w2} r={headR * 1.9} color={`rgba(${rgbHue},0.34)`}>
        <BlurMask blur={headR * 1.4} style="normal" />
      </SkiaCircle>
      <SkiaCircle c={w1} r={headR * 2.2} color={`rgba(${rgbHue},0.5)`}>
        <BlurMask blur={headR * 1.3} style="normal" />
      </SkiaCircle>
      {/* Head — wide white halo + a blown white core. */}
      <SkiaCircle c={head} r={headR * 3} color="rgba(255,255,255,0.55)">
        <BlurMask blur={headR * 1.8} style="normal" />
      </SkiaCircle>
      <SkiaCircle c={head} r={headR * 1.15} color="rgba(255,255,255,0.98)">
        <BlurMask blur={headR * 0.4} style="normal" />
      </SkiaCircle>
    </SkiaGroup>
  )
}

/* MonthConstellationLayer — the Skia <Canvas> overlay (inside a
 * FLARE_PAD-overscan wrapper) that draws the whole constellation for the
 * active satellite's `kind`: energy lines first (under), then bloom stars.
 *
 * Choreography: a single PAINTING LIGHT travels the route (`lit` 0→1 over
 * ~1.6 s). Every node + line keys its own ignite/draw off `lit` vs its route
 * fraction, so the figure is drawn one star at a time IN THE LIGHT'S WAKE —
 * not all at once. `settle` lands after the traversal → bloom calms so the
 * annotation text reads on top.
 * Reduced motion: `lit` sweeps to 1 in ~280 ms (quick fade-in) and the
 * travelling head (EnergyCurrent) is not mounted.
 *
 * Re-mounts on the active satellite id (parent `key`) so each pattern
 * switch re-fires the choreography fresh. */
const MonthConstellationLayer = memo(function MonthConstellationLayer({
  kind,
  dimColor,
  k,
  t,
  reduced,
  spinDeg = 0,
}: {
  kind: SatelliteKind
  /** The active satellite's dimension hex (e.g. cuerpo #FF4886). */
  dimColor: string
  k: number
  /** Shared breathing clock (the layer's 8 s loop). */
  t: SharedValue<number>
  reduced: boolean
  /** Static rotation (deg, negative = left/CCW) around the figure's
   *  centroid — used so `tu pausa`'s crescent tilts with its moon. */
  spinDeg?: number
}) {
  const shape = CONSTELLATION_SHAPES[kind]
  const rgbHue = monthRgb(dimColor)

  // Post-show settle — 0 during the spectacle, 1 once it calms.
  const settle = useSharedValue(0)
  // The painting light's traversal position 0→1. Every node + line keys its
  // own ignite/draw off this, so the figure is PAINTED as the light recorre
  // it — not lit all at once.
  const lit = useSharedValue(0)

  useEffect(() => {
    if (reduced) {
      // No travelling light — sweep `lit` to 1 quickly so the whole figure
      // fades in; EnergyCurrent is not mounted under reduced motion.
      lit.value = withTiming(1, { duration: 280 })
      settle.value = 0
      return () => {
        cancelAnimation(lit)
        cancelAnimation(settle)
      }
    }
    // The light travels the whole route, painting the figure in its wake.
    // Slower (1800 vs 1000 ms) so you can WATCH the constellation being drawn
    // line by line — the trace IS the moment, not a quick flourish.
    lit.value = withDelay(120, withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }))
    // Once the figure is fully drawn, the bloom calms so the text reads.
    settle.value = withDelay(
      2000,
      withTiming(1, { duration: 420, easing: Easing.inOut(Easing.cubic) }),
    )
    return () => {
      cancelAnimation(lit)
      cancelAnimation(settle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, reduced])

  // Route polyline (canvas px) the painting light rides — the kind's ordered
  // `route` nodes, hero → outward.
  const routePts = shape.route.map((idx) => shape.nodes[idx]!)
  const wpX = routePts.map((p) => p.x * k + FLARE_PAD)
  const wpY = routePts.map((p) => p.y * k + FLARE_PAD)
  const cumLen: number[] = [0]
  for (let i = 1; i < wpX.length; i++) {
    cumLen[i] = cumLen[i - 1]! + Math.hypot(wpX[i]! - wpX[i - 1]!, wpY[i]! - wpY[i - 1]!)
  }
  const totalLen = cumLen[cumLen.length - 1] || 1

  // Per-node route fraction = WHEN the light reaches it. Route nodes get their
  // arc-length fraction; branch nodes inherit the nearest route node's
  // fraction (+ a small hop per edge) so a side star ignites just after the
  // light passes its connection point.
  const routePos = new Map<number, number>()
  shape.route.forEach((idx, j) => routePos.set(idx, j))
  const nodeFrac: number[] = shape.nodes.map((_, i) => {
    const pos = routePos.get(i)
    return pos !== undefined ? cumLen[pos]! / totalLen : Infinity
  })
  for (let pass = 0; pass < shape.nodes.length; pass++) {
    let changed = false
    for (const [a, b] of shape.edges) {
      if (routePos.get(b) === undefined && nodeFrac[a]! + 0.03 < nodeFrac[b]!) {
        nodeFrac[b] = nodeFrac[a]! + 0.03
        changed = true
      }
      if (routePos.get(a) === undefined && nodeFrac[b]! + 0.03 < nodeFrac[a]!) {
        nodeFrac[a] = nodeFrac[b]! + 0.03
        changed = true
      }
    }
    if (!changed) break
  }
  for (let i = 0; i < nodeFrac.length; i++) {
    nodeFrac[i] = Math.min(1, isFinite(nodeFrac[i]!) ? nodeFrac[i]! : 0.5)
  }

  // Optional static rotation around the figure's centroid (canvas px) — so
  // the whole constellation (stars + lines + light) can tilt as one.
  const cxPx = (shape.nodes.reduce((s, n) => s + n.x, 0) / shape.nodes.length) * k + FLARE_PAD
  const cyPx = (shape.nodes.reduce((s, n) => s + n.y, 0) / shape.nodes.length) * k + FLARE_PAD
  const spinT = spinDeg
    ? [
        { translateX: cxPx },
        { translateY: cyPx },
        { rotate: (spinDeg * Math.PI) / 180 },
        { translateX: -cxPx },
        { translateY: -cyPx },
      ]
    : []

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <SkiaGroup transform={spinT}>
        {/* Energy lines — each draws as the light crosses it. Source = the
          endpoint the light reaches first (lower route fraction). */}
        {shape.edges.map((edge, i) => {
          const [a, c] = edge
          const fa = nodeFrac[a]!
          const fc = nodeFrac[c]!
          const aIsSource = fa <= fc
          const src = aIsSource ? shape.nodes[a]! : shape.nodes[c]!
          const tgt = aIsSource ? shape.nodes[c]! : shape.nodes[a]!
          const lo = Math.min(fa, fc)
          const hi = Math.max(fa, fc)
          // Cap the draw window so a LONG edge doesn't draw across the whole
          // traversal: it starts at most DRAW_WINDOW before its far endpoint
          // ignites. Normal chain edges (endpoints <0.25 apart) are unaffected
          // — only the burst's rays (centre→tip, far apart) get pulled to
          // "just-in-time" so they trace one by one as the light sweeps.
          const DRAW_WINDOW = 0.25
          const sFrac = Math.max(lo, hi - DRAW_WINDOW)
          const eFrac = Math.max(hi, sFrac + 0.05)
          // tentative edge index 4 ([2,4]) is the hypothesis link → dashed.
          const dashed = kind === 'tentative' && i === 4
          return (
            <EnergyLine
              key={`edge-${i}`}
              sx={src.x}
              sy={src.y}
              tx={tgt.x}
              ty={tgt.y}
              k={k}
              rgbHue={rgbHue}
              lit={lit}
              sFrac={sFrac}
              eFrac={eFrac}
              settle={settle}
              dashed={dashed}
            />
          )
        })}
        {/* Bloom stars — each ignites when the light reaches its fraction. */}
        {shape.nodes.map((n, i) => (
          <MonthBloomStar
            key={`node-${i}`}
            vbX={n.x}
            vbY={n.y}
            hero={!!n.hero}
            mag={n.mag}
            k={k}
            t={t}
            phase={(i * 0.19) % 1}
            rgbHue={rgbHue}
            lit={lit}
            frac={nodeFrac[i]!}
            settle={settle}
            reduced={reduced}
          />
        ))}
        {/* The painting light's head + wake riding the route. Skipped under
          reduced motion AND when the route is a single point (a radial burst
          like `peak` has no travelling head — it flashes outward at once). */}
        {reduced || wpX.length < 2 ? null : (
          <EnergyCurrent
            wpX={wpX}
            wpY={wpY}
            cumLen={cumLen}
            totalLen={totalLen}
            rgbHue={rgbHue}
            k={k}
            lit={lit}
            settle={settle}
          />
        )}
      </SkiaGroup>
    </Canvas>
  )
})

/* Annotation overlay — the reveal's text, GROUPED as one block in the lower
 * zone so the pattern name + the coach phrase read as a single idea (the
 * constellation is the protagonist above, with no text over it). The eyebrow
 * is just the pattern name — the confirmed/tentative state is carried by the
 * light + the phrase, not a verdict badge. Lands after the energy current
 * winds down (~1.9 s) so the text never fights the still-running show. */
function AnnotationOverlay({ eyebrow, body }: { eyebrow: string; body: string }) {
  const eyebrowT = useSharedValue(0)
  const bodyT = useSharedValue(0)
  const hintT = useSharedValue(0)
  useEffect(() => {
    // Text lands AFTER the (now slower) trace finishes (~1.9 s) so it never
    // appears over a constellation still being drawn.
    eyebrowT.value = withDelay(
      2050,
      withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }),
    )
    bodyT.value = withDelay(
      2200,
      withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }),
    )
    // The way back arrives last and quietest — once the page has fully
    // settled, a faint line tells you the cosmos closes with a tap.
    hintT.value = withDelay(
      3000,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    )
    return () => {
      cancelAnimation(eyebrowT)
      cancelAnimation(bodyT)
      cancelAnimation(hintT)
    }
  }, [eyebrowT, bodyT, hintT])

  const eyebrowStyle = useAnimatedStyle(() => {
    'worklet'
    return { opacity: eyebrowT.value }
  })
  const bodyStyle = useAnimatedStyle(() => {
    'worklet'
    return { opacity: bodyT.value, transform: [{ translateY: (1 - bodyT.value) * 6 }] }
  })
  const hintStyle = useAnimatedStyle(() => {
    'worklet'
    return { opacity: hintT.value * 0.6 }
  })

  return (
    <View style={annotationStyles.block} pointerEvents="none">
      <Animated.Text style={[annotationStyles.eyebrowText, eyebrowStyle]} numberOfLines={1}>
        {eyebrow}
      </Animated.Text>
      <Animated.Text style={[annotationStyles.bodyText, bodyStyle]} numberOfLines={3}>
        {body}
      </Animated.Text>
      <Animated.Text style={[annotationStyles.hintText, hintStyle]} numberOfLines={1}>
        toca fuera para volver
      </Animated.Text>
    </View>
  )
}

const annotationStyles = StyleSheet.create({
  // One grouped text block low on the canvas (the constellation owns the
  // space above). Capped at the left ~66 % so it never nears the chain.
  block: {
    position: 'absolute',
    top: '70%',
    left: 0,
    right: '34%',
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  // Pattern name — small gold kicker (observatory light, no magenta).
  eyebrowText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.oro,
    marginBottom: 8,
  },
  // The coach phrase — italic serif (the one voice on this screen).
  bodyText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 19,
    color: colors.leche,
    textAlign: 'center',
  },
  // Whispered way back — niebla, tracked-out, last to arrive.
  hintText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.niebla,
    textAlign: 'center',
    marginTop: 14,
  },
})

/* GhostConstellation — a faint, static LATENT figure drawn in the cosmos
 * when nothing is selected: thin cream lines + small dots tracing the
 * brillo satellite's constellation at low opacity. REMOVED from the resting
 * render (it read as orphaned noise disconnected from the chain); kept here
 * for an easy revert if the "foreshadow" idea returns. Plain SVG, no bloom. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function GhostConstellation({ kind }: { kind: SatelliteKind }) {
  const shape = CONSTELLATION_SHAPES[kind]
  return (
    <G opacity={0.2}>
      {shape.edges.map((e, i) => {
        const a = shape.nodes[e[0]]!
        const b = shape.nodes[e[1]]!
        return (
          <Line
            key={`ghost-l-${i}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={colors.leche}
            strokeWidth={0.5}
            strokeLinecap="round"
            opacity={0.7}
          />
        )
      })}
      {shape.nodes.map((n, i) => (
        <Circle key={`ghost-n-${i}`} cx={n.x} cy={n.y} r={n.hero ? 1.8 : 1.1} fill={colors.leche} />
      ))}
    </G>
  )
}

/* MoonReveal — the observatory-ink moon engraving shown behind the `tu pausa`
 * star ring. Uniform EMBLEM_INK at EMBLEM_OPACITY (homogenized: same page as
 * the other three), easing in with a soft rise. */
function MoonReveal({ reduced }: { reduced: boolean }) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withTiming(1, { duration: reduced ? 250 : 760, easing: Easing.out(Easing.cubic) })
    return () => cancelAnimation(t)
  }, [t, reduced])
  const style = useAnimatedStyle(() => ({
    // Whispers behind the star ring (the stars are the protagonist).
    opacity: t.value * EMBLEM_OPACITY,
    // rotate -25° (left/CCW, matches the constellation's spinDeg) applied
    // OUTERMOST; scaleX:-1 mirrors the moon so its bright limb opens LEFT.
    transform: [{ rotate: '-25deg' }, { scaleX: -1 }, { scale: 0.9 + t.value * 0.1 }],
  }))
  return (
    <Animated.View pointerEvents="none" style={[moonRevealStyles.wrap, style]}>
      <MoonArt
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        color={EMBLEM_INK}
        fill={EMBLEM_INK}
      />
    </Animated.View>
  )
}

const moonRevealStyles = StyleSheet.create({
  // Centred so the moon disc lands at viewBox (≈126, 164) R≈96 — exactly
  // under the star ring, clear of the chain on the right.
  wrap: {
    position: 'absolute',
    left: '11%',
    top: '17.6%',
    width: '48.3%',
    height: '55.7%',
  },
})

/* AnchorReveal — the observatory-ink anchor engraving behind the `tu ancla`
 * star figure. Now matches the other three: uniform EMBLEM_INK at
 * EMBLEM_OPACITY (it previously rendered at full opacity, which made it
 * dominate — the homogenization bug this pass fixes). */
function AnchorReveal({ reduced }: { reduced: boolean }) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withTiming(1, { duration: reduced ? 250 : 760, easing: Easing.out(Easing.cubic) })
    return () => cancelAnimation(t)
  }, [t, reduced])
  const style = useAnimatedStyle(() => ({
    opacity: t.value * EMBLEM_OPACITY,
    transform: [{ scale: 0.9 + t.value * 0.1 }],
  }))
  return (
    <Animated.View pointerEvents="none" style={[anchorRevealStyles.wrap, style]}>
      <AnchorLineArt
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        color={EMBLEM_INK}
        fill={EMBLEM_INK}
      />
    </Animated.View>
  )
}

const anchorRevealStyles = StyleSheet.create({
  // Slightly BIGGER (56→60), nudged LEFT (9→3) and UP (22→15) so the emblem
  // lifts clear of the annotation text below it. Near-square (anchor vb ~1:1).
  wrap: {
    position: 'absolute',
    left: '-1.4%',
    top: '6.1%',
    width: '74.7%',
    height: '74.7%',
  },
})

/* ShineReveal — the observatory-ink RADIAL STAR behind the `tu brillo` burst.
 * Centred + symmetric (no scaleY stretch now — the figure is a radial sparkle,
 * not a vertical figure), uniform EMBLEM_INK at EMBLEM_OPACITY. */
function ShineReveal({ reduced }: { reduced: boolean }) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withTiming(1, { duration: reduced ? 250 : 760, easing: Easing.out(Easing.cubic) })
    return () => cancelAnimation(t)
  }, [t, reduced])
  const style = useAnimatedStyle(() => ({
    opacity: t.value * EMBLEM_OPACITY,
    transform: [{ scale: 0.9 + t.value * 0.1 }],
  }))
  return (
    <Animated.View pointerEvents="none" style={[shineRevealStyles.wrap, style]}>
      <ShineFigureArt
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        color={EMBLEM_INK}
        fill={EMBLEM_INK}
      />
    </Animated.View>
  )
}

const shineRevealStyles = StyleSheet.create({
  // SQUARE box behind the burst — BIGGER again (66→72) and re-centred on the
  // burst, which moved left (centroid ≈128 ≈ 34.4% of W). left/top set so the
  // emblem centre tracks the burst.
  wrap: {
    position: 'absolute',
    left: '-0.9%',
    top: '8.3%',
    width: '73.8%',
    height: '73.8%',
  },
})

/* WatchReveal — the observatory-ink watch engraving (ornate floral ring +
 * inner diamond) behind the `stelar te observa` diamond. Uniform EMBLEM_INK
 * at EMBLEM_OPACITY (it used to read cool-blue via the dimension tint — the
 * worst break in the old palette; now it's gold like the rest). */
function WatchReveal({ reduced }: { reduced: boolean }) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withTiming(1, { duration: reduced ? 250 : 760, easing: Easing.out(Easing.cubic) })
    return () => cancelAnimation(t)
  }, [t, reduced])
  const style = useAnimatedStyle(() => ({
    opacity: t.value * EMBLEM_OPACITY,
    transform: [{ scale: 0.9 + t.value * 0.1 }],
  }))
  return (
    <Animated.View pointerEvents="none" style={[watchRevealStyles.wrap, style]}>
      <WatchFigureArt
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        color={EMBLEM_INK}
        fill={EMBLEM_INK}
      />
    </Animated.View>
  )
}

const watchRevealStyles = StyleSheet.create({
  // Slightly BIGGER (60→63) and moved LEFT (4.5→0.5) + UP (14→9.5) to travel
  // WITH the constellation (its diamond stars also shifted −14,−14).
  wrap: {
    position: 'absolute',
    left: '1.3%',
    top: '11.4%',
    width: '67.8%',
    height: '67.8%',
  },
})

function MonthSkyImpl({
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
  const reduced = useReducedMotion() ?? false
  // Pause every ambient loop when the Órbita tab isn't focused (Freeze/
  // freezeOnBlur don't stop the UI-thread withRepeat timers — this does).
  const screenActive = useScreenActive()
  // One clock: `twinkle` (6 s) drives the starfield shimmer (and the
  // optional first-item "tap me" affordance pulse). The active node's
  // breathing aura + pulsing core run on their OWN clocks, owned by the
  // ActiveAura / ActiveCore components (mounted only for the active sat).
  const twinkle = useSharedValue(0)
  // Shared 8 s breathing loop for the reveal's bloom stars (mirrors the
  // WeekConstellation `t` loop). Drives only the active reveal.
  const revealT = useSharedValue(0)
  // Ambient depth/motion clocks (resting cosmos). Long, desynced loops so
  // nothing pulses to a metronome: deep starfield parallax (slow), nebula
  // breath, dust drift, and a faster near-layer parallax for the bright
  // NODES (the parallax delta deep↔near is what reads as depth).
  const driftSlow = useSharedValue(0)
  const driftFast = useSharedValue(0)
  const nebulaBreath = useSharedValue(0)
  const dustDrift = useSharedValue(0)
  // viewBox → pixel factor for the Skia constellation overlay, from the
  // root wrap's measured width. 0 until first layout (Canvas withheld).
  const [flareK, setFlareK] = useState(0)

  useEffect(() => {
    if (!screenActive) return // off-tab → don't run the cosmos; cleanup paused it
    twinkle.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false)
    revealT.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    if (!reduced) {
      driftSlow.value = withRepeat(
        withTiming(1, { duration: 40000, easing: Easing.linear }),
        -1,
        true,
      )
      driftFast.value = withRepeat(
        withTiming(1, { duration: 26000, easing: Easing.linear }),
        -1,
        true,
      )
      nebulaBreath.value = withRepeat(
        withTiming(1, { duration: 14000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      )
      dustDrift.value = withRepeat(
        withTiming(1, { duration: 22000, easing: Easing.linear }),
        -1,
        false,
      )
    }
    return () => {
      cancelAnimation(twinkle)
      cancelAnimation(revealT)
      cancelAnimation(driftSlow)
      cancelAnimation(driftFast)
      cancelAnimation(nebulaBreath)
      cancelAnimation(dustDrift)
    }
  }, [screenActive, twinkle, revealT, driftSlow, driftFast, nebulaBreath, dustDrift, reduced])

  // Parallax transforms — the deep starfield drifts a little, the near
  // NODES drift roughly double, so the eye infers depth between the layers.
  const deepDrift = useAnimatedProps(() => {
    'worklet'
    if (reduced) return { transform: [{ translateX: 0 }, { translateY: 0 }] }
    const a = driftSlow.value * TWO_PI
    return { transform: [{ translateX: Math.cos(a) * 3 }, { translateY: Math.sin(a) * 2 }] }
  })
  const nodesDrift = useAnimatedProps(() => {
    'worklet'
    if (reduced) return { transform: [{ translateX: 0 }, { translateY: 0 }] }
    const a = driftFast.value * TWO_PI
    return { transform: [{ translateX: Math.cos(a) * 6 }, { translateY: Math.sin(a) * 4 }] }
  })

  const sats = satellites.slice(0, SAT_POS.length).map((sat, i) => ({
    ...sat,
    x: SAT_POS[i]!.x,
    y: SAT_POS[i]!.y,
  }))

  // Look up the active chain item — its position is the origin
  // for the "fly to centre" animation of the summoned pattern.
  const activeSat = selectedSatelliteId
    ? (sats.find((s) => s.id === selectedSatelliteId) ?? null)
    : null

  // During a reveal, fade the central MAGENTA washes (m-nebula + axis-haze)
  // toward neutral so the dimension-coloured constellation has a calm field
  // to glow against instead of a same-hue wash it dissolves into.
  const revealFade = useSharedValue(0)
  const revealActive = activeSat != null
  useEffect(() => {
    revealFade.value = withTiming(revealActive ? 1 : 0, {
      duration: revealActive ? 520 : 360,
      easing: Easing.inOut(Easing.cubic),
    })
    return () => cancelAnimation(revealFade)
  }, [revealActive, revealFade])
  const warmFadeProps = useAnimatedProps(() => {
    'worklet'
    return { opacity: 1 - revealFade.value * 0.82 }
  })

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width
        if (w > 0) setFlareK(w / W)
      }}
    >
      {/* BACK SVG — everything BEHIND the chain: deep starfield, the
          left-weighted nebula fog, the off-centre axis-haze that pulls
          gravity to the chain column, and the twinkling foreground
          starfield. */}
      <Svg viewBox={`0 0 ${W} ${W}`} style={[styles.svg, StyleSheet.absoluteFill]}>
        <Defs>
          {/* Inner magenta wash — the centre-warm hue. */}
          <RadialGradient id="m-nebula" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.magenta} stopOpacity={0.08} />
            <Stop offset="60%" stopColor={colors.magenta} stopOpacity={0.02} />
            <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
          </RadialGradient>
          {/* Axis-haze — a very tenue magenta wash aligned with the
              CHAIN column (off-centre, right), replacing the old
              centred BH aura that lit the now-empty middle. Gives the
              chain a sense of gravity/altar without a new object. */}
          <RadialGradient id="axis-haze" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.magenta} stopOpacity={0.07} />
            <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
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
          {/* Edge-fade vignette — so the square canvas doesn't show a hard
              border against the screen. The cosmos fades to transparent at
              the edges + corners → it blends into the tab's SkyBackground
              instead of reading as a bright square. */}
          <RadialGradient id="sky-vignette" cx="50%" cy="50%" r="55%">
            <Stop offset="0" stopColor="#fff" stopOpacity={1} />
            <Stop offset="0.6" stopColor="#fff" stopOpacity={1} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </RadialGradient>
          <Mask id="sky-mask" x="0" y="0" width={W} height={W}>
            <Rect x="0" y="0" width={W} height={W} fill="url(#sky-vignette)" />
          </Mask>
        </Defs>

        {/* The whole cosmos backdrop is masked by the edge-fade vignette so
            it dissolves into the screen at the canvas border (no square). */}
        <G mask="url(#sky-mask)">
          {/* DEPTH LAYER A — distant starfield, parallax-drifting as one
              group (the far layer; moves least). Centre-band fill keeps the
              middle reading as deep textured sky, not erased. */}
          <AnimatedG animatedProps={deepDrift}>
            {DEEP_STARS.map((s, i) => (
              <Circle
                key={`ds-${i}`}
                cx={s.x}
                cy={s.y}
                r={s.r}
                fill={colors.leche}
                opacity={s.op}
              />
            ))}
          </AnimatedG>

          {/* DEPTH LAYER B — left-weighted nebula fog, each cloud breathing
              (opacity + scale) on a slow desynced loop. Heavy mass on the
              left, faded on the right so it doesn't compete with the chain. */}
          {NEBULA_CLOUDS.map((c, i) => (
            <NebulaCloud
              key={`cloud-${i}`}
              cloud={c}
              idx={i}
              clock={nebulaBreath}
              reduced={reduced}
            />
          ))}

          {/* Cosmic dust drifting over the fog (etherial depth). */}
          <DustField clock={dustDrift} reduced={reduced} />

          {/* DEPTH LAYER C — axis-haze. A tall, narrow magenta glow
              aligned with the chain column. Fades toward neutral during a
              reveal so it doesn't tint the dimension constellation. */}
          <AnimatedG animatedProps={warmFadeProps}>
            <Ellipse rx={105} ry={158} cx={AXIS_X} cy={179} fill="url(#axis-haze)" />
          </AnimatedG>

          {/* Foreground starfield — bucketed twinkle (one worklet per bucket). */}
          <G>
            {STAR_BUCKETS.map((group, b) => (
              <MonthStarBucket
                key={`sb-${b}`}
                stars={group}
                index={b}
                clock={twinkle}
                reduced={reduced}
              />
            ))}
          </G>

          {/* Occasional shooting star — the upper-area sparkle. */}
          <ShootingStar reduced={reduced} screenActive={screenActive} />

          {/* Inner nebula wash — closer-in centre warmth. Fades during a
              reveal so the magenta doesn't bleed into the constellation. */}
          <AnimatedG animatedProps={warmFadeProps}>
            <Circle cx={CX} cy={CY} r={W * 0.5} fill="url(#m-nebula)" />
          </AnimatedG>
        </G>
      </Svg>

      {/* Lottie ambient removed — its "breathing accretion-disk shimmer"
          read as a big circular halo pulsing behind the chain, which the
          owner didn't want. The static starfield + twinkle carry the
          ambient life now. */}

      {/* FRONT SVG — constellation spine + bright nodes + chain glow
          + labels. */}
      <Svg viewBox={`0 0 ${W} ${W}`} style={[styles.svg, StyleSheet.absoluteFill]}>
        <Defs>
          {/* (Satellite aura + field gradients moved INTO each SatBody as
              inline userSpaceOnUse gradients — a shared objectBoundingBox
              gradient reused across bodies rendered as a square in
              react-native-svg.) */}
        </Defs>

        {/* CONSTELLATION SPINE — the gold thread that turns the four
            satellites into one system (cartography chrome, hence gold,
            NOT magenta). A DOUBLE thread now: a thick faint underlay +
            a thin bright overlay, for a struck-metal cord. Drawn FIRST
            so it sits behind the medallions. The whole thread lifts when
            a body is selected; a luminous bead marks each node centre. */}
        {sats.length > 1 ? (
          <G>
            {/* Thick faint underlay — gives the cord body. */}
            <Path
              d={SPINE_D}
              fill="none"
              stroke={colors.oro}
              strokeWidth={2.2}
              strokeOpacity={activeSat ? 0.12 : 0.07}
              strokeLinecap="round"
            />
            {/* Thin bright overlay — the polished catch-light. */}
            <Path
              d={SPINE_D}
              fill="none"
              stroke={colors.oroLight}
              strokeWidth={0.7}
              strokeOpacity={activeSat ? 0.5 : 0.34}
              strokeLinecap="round"
            />
            {sats.map((s, i) => {
              // Beads near the selected node stay bright; the rest dim
              // so the eye follows the thread toward the active body.
              // Non-active beads stay at 0.32 (was 0.15) so the gold thread
              // keeps anchoring the inactive nodes — the chain reads as "a
              // constellation traced, nodes not yet lit", not four loose dots.
              const beadOp = activeSat ? (activeSat.id === s.id ? 0.7 : 0.32) : 0.5
              return (
                <Circle
                  key={`spine-${i}`}
                  cx={s.x}
                  cy={s.y}
                  r={1.6}
                  fill={colors.oroLight}
                  opacity={beadOp}
                />
              )
            })}
          </G>
        ) : null}

        {/* BRIDGE — a faint dotted thread of light from the lit medallion to
            the heart of its constellation, tying WHAT YOU TAPPED (the chain on
            the right) to WHAT IGNITED (the constellation on the left), which
            otherwise float disconnected. Bows up a touch so it reads as a
            gesture, not a ruler. Only while a body is active. */}
        {activeSat
          ? (() => {
              const shape = CONSTELLATION_SHAPES[activeSat.kind ?? 'peak']
              const ccx = shape.nodes.reduce((s, n) => s + n.x, 0) / shape.nodes.length
              const ccy = shape.nodes.reduce((s, n) => s + n.y, 0) / shape.nodes.length
              const midX = (activeSat.x + ccx) / 2
              const midY = (activeSat.y + ccy) / 2 - 22
              return (
                <Path
                  d={`M ${activeSat.x} ${activeSat.y} Q ${midX} ${midY} ${ccx} ${ccy}`}
                  fill="none"
                  stroke={colors.oroLight}
                  strokeWidth={0.7}
                  strokeOpacity={0.22}
                  strokeDasharray="0.5 6"
                  strokeLinecap="round"
                />
              )
            })()
          : null}

        {/* Bright pin-point nodes — the NEAR layer; parallax-drifts ~2× the
            deep starfield so the depth between them reads. */}
        <AnimatedG animatedProps={nodesDrift}>
          {NODES.map((n, i) => (
            <NodePoint key={`node-${i}`} x={n.x} y={n.y} size={n.size} />
          ))}
        </AnimatedG>

        {/* Ghost constellation REMOVED at rest — the latent figure made
            the resting canvas feel pre-populated with shapes the user
            hadn't earned yet. Empty centre stays empty until the user
            taps a satellite; the reveal then has full surprise. The
            `GhostConstellation` component is kept below for an easy
            revert if this decision is reversed. */}

        {/* Pattern satellites + labels. When a chain item is active,
            the others dim to 35 % so the focus stays on the selected
            pattern + its evidence. `active` unifies the explicit
            `selected` flag with the runtime `activeSat` selection so
            the talisman frame + aura both IGNITE to gold together. The
            active node re-mounts on its id (`key`) so its breathing /
            ignition-flash clocks re-fire fresh on each pattern switch. */}
        {sats.map((sat) => {
          // labelX clears the FRAME, not just the medallion: the SatFrame
          // teeth/spikes reach to ~MEDALLION_R + 9, so subtracting only
          // MEDALLION_R buried the text under the frame. Push it past the
          // spikes + a gap so the label reads clean.
          const labelX = sat.x - MEDALLION_R - 15
          const labelY = sat.y + 3
          const active = sat.selected || activeSat?.id === sat.id
          const dimmed = activeSat != null && activeSat.id !== sat.id
          // During a reveal the ACTIVE node's label is hidden: the annotation
          // overlay already names the pattern in large type, so repeating it on
          // the medallion was a duplicate that also collided with the frame.
          const showLabel = !(active && activeSat != null)
          return (
            <G key={sat.id} opacity={dimmed ? 0.3 : 1}>
              <SatBody
                key={active ? `body-active-${sat.id}` : `body-${sat.id}`}
                x={sat.x}
                y={sat.y}
                active={active}
                gid={sat.id}
              />
              {showLabel ? (
                <SvgText
                  x={labelX}
                  y={labelY}
                  textAnchor="end"
                  fontFamily={typography.uiBold}
                  fontSize={11.5}
                  letterSpacing={1.2}
                  fill={active ? colors.oroLeche : colors.leche}
                  opacity={active ? 1 : sat.kind === 'tentative' ? 0.7 : 0.9}
                >
                  {sat.label}
                </SvgText>
              ) : null}
            </G>
          )
        })}
      </Svg>

      {/* Pattern glyphs — rendered as RN Views overlaying the canvas.
          They can't live inside the Svg (nesting Svgs isn't supported),
          so this layer sits between the SVG glow (back) and the tap
          targets (front). The art comes from orbit-art by `kind`. The
          first item gets an affordance pulse when nothing is selected,
          so the chain is discoverable. */}
      {sats.map((sat, i) => {
        const active = sat.selected || activeSat?.id === sat.id
        const dimmed = activeSat != null && activeSat.id !== sat.id
        // Nothing selected → ALL four pulse softly (staggered) so the
        // whole chain reads as tappable, not just the first.
        const affordance = activeSat == null
        return (
          <PatternChainIcon
            key={`icon-${sat.id}`}
            pos={{ x: sat.x, y: sat.y }}
            kind={sat.kind}
            clock={twinkle}
            dimmed={dimmed}
            active={active}
            affordance={affordance}
            phase={i * 0.25}
          />
        )
      })}

      {/* CONSTELLATION REVEAL — when a chain item is active, the cosmos
          lights a CONSTELLATION on the left/center: a faint dimension
          glyph behind, the Skia bloom-stars + thick energy lines on top,
          and the pattern's text annotations layered into the canvas as
          if it were a page from an astronomy book. No lateral panel, no
          bottom sheet — the cosmos IS the page. All layers re-mount on
          `key={selectedSatelliteId}` so the reveal re-fires fresh on each
          pattern switch. */}
      {activeSat && evidence ? (
        <React.Fragment key={`ignite-${activeSat.id}`}>
          {/* tu pausa also paints the MOON figure BEHIND its star ring (the
              stars sit on the moon's limb); every other body shows only its
              constellation. Moon first (behind), constellation on top. */}
          {activeSat.kind === 'valley' ? <MoonReveal reduced={reduced} /> : null}
          {/* tu ancla paints the ANCHOR emblem behind its star figure. */}
          {activeSat.kind === 'stable' ? <AnchorReveal reduced={reduced} /> : null}
          {/* tu brillo paints the SHINE emblem behind its vertical figure. */}
          {activeSat.kind === 'peak' ? <ShineReveal reduced={reduced} /> : null}
          {/* stelar te observa paints the WATCH emblem behind its diamond. */}
          {activeSat.kind === 'tentative' ? <WatchReveal reduced={reduced} /> : null}
          {/* Skia constellation overlay — bloom stars + energy lines, inside
              the FLARE_PAD-overscan wrapper so edge blooms bleed into the
              margin. pointerEvents off so taps fall through to the backdrop.
              Mounts once the wrap has measured (k>0). */}
          {flareK > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: -FLARE_PAD,
                left: -FLARE_PAD,
                right: -FLARE_PAD,
                bottom: -FLARE_PAD,
              }}
              pointerEvents="none"
            >
              <MonthConstellationLayer
                kind={activeSat.kind ?? 'stable'}
                dimColor={harmonizeDim(colors.dimension[activeSat.dimensionKey])}
                k={flareK}
                t={revealT}
                reduced={reduced}
                spinDeg={activeSat.kind === 'valley' ? -25 : 0}
              />
            </View>
          ) : null}

          {/* RN Text overlay — the pattern name + the coach phrase, grouped
              as one block low on the canvas. Eyebrow is just the name; state
              is carried by the light + the phrase. pointerEvents=none. */}
          <AnnotationOverlay eyebrow={evidence.label.toUpperCase()} body={evidence.detail} />

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

// Memoized: MonthSegment re-renders on every state tick, but the Skia/SVG
// constellation tree is costly — only re-render when props actually change
// (callbacks + evidence are now stabilized upstream).
export const MonthSky = memo(MonthSkyImpl)

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    aspectRatio: 1,
  },
  svg: {
    width: '100%',
    height: '100%',
  },
  // Pattern badge overlay — the glyph, sized as a % of the (square)
  // canvas so it scales with the SVG glow it sits in. Positioned by
  // percentage with a -half-size % margin so it centres on the chain
  // item's viewBox coords. pointerEvents="none" so taps fall through.
  chainIconWrap: {
    position: 'absolute',
    width: `${ICON_PCT}%`,
    height: `${ICON_PCT}%`,
    marginLeft: `${-ICON_PCT / 2}%`,
    marginTop: `${-ICON_PCT / 2}%`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Transparent frame — the gold illustration fills it (no dark disc, no
  // border) and the frame fills the wrap, so the art tracks the glow.
  chainIconDisc: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hit: {
    position: 'absolute',
    width: HIT,
    height: HIT,
    marginLeft: -HIT / 2,
    marginTop: -HIT / 2,
  },
})
