import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { Defs, Line, LinearGradient, Stop } from 'react-native-svg'

import type { ZodiacDef } from '../../../../zodiac/types'
import { AnimatedG, AnimatedLine } from '../../animation/animated-components'
import type { Resolved, SequenceEl } from '../../types'

/* ─ Lit & next lines ────────────────────────────────────────────── */

export function LitLines({
  zodiac,
  stars,
  litKeys,
  nextEl,
  ignitingKey,
  litPulse,
  breathT,
  lineDepth,
  t,
}: {
  zodiac: ZodiacDef
  stars: Resolved[]
  litKeys: Set<string>
  nextEl: SequenceEl | null
  /** While set, the matching line is skipped here so IgnitingOverlay
   *  can draw its stroke-trace flash on top without doubling up. */
  ignitingKey: string | null
  /** 0..1 ripple driven by the parent on each slider commit. Bumps
   *  the lit lines' group opacity from 0.92 → 1 so the whole figure
   *  reads as "just got brighter". */
  litPulse: SharedValue<number>
  /** The 16s clock that drives the cascading-ripple breath. Combined
   *  with per-line depth, each line pulses in sync with the closer
   *  of its two endpoint stars. */
  breathT: SharedValue<number>
  /** Per-line depth (BFS distance from the alpha through the nearer
   *  endpoint). Used to offset each line's breath window so the wave
   *  radiates outward in time. */
  lineDepth: readonly number[]
  /** The 8s system clock — drives the travelling energy beam dash
   *  on each lit filament so a bright cream "particle" slides from
   *  the alpha side toward the far endpoint of every lit edge. */
  t: SharedValue<number>
}) {
  const groupProps = useAnimatedProps(() => {
    'worklet'
    // The base group opacity is no longer where the breath lives —
    // each line carries its own depth-shifted brighten now. We keep
    // the litPulse commit-ripple here so the entire figure still
    // surges as one on each Hoy tap.
    return { opacity: 0.92 + litPulse.value * 0.08 }
  })
  return (
    <AnimatedG animatedProps={groupProps}>
      {zodiac.lines.map(([a, b], idx) => {
        const A = stars[a]
        const B = stars[b]
        if (!A || !B) return null
        const isLit = litKeys.has(`line-${idx}`)
        const isNext = nextEl?.type === 'line' && nextEl.idx === idx
        if (!isLit && !isNext) return null
        if (ignitingKey === `line-${idx}`) return null
        if (isLit) {
          return (
            <LitLineFilament
              key={`l-${idx}`}
              idx={idx}
              ax={A.x}
              ay={A.y}
              bx={B.x}
              by={B.y}
              breathT={breathT}
              depth={lineDepth[idx] ?? 0}
              t={t}
            />
          )
        }
        return (
          <Line
            key={`l-${idx}`}
            x1={A.x}
            y1={A.y}
            x2={B.x}
            y2={B.y}
            stroke="rgba(233,30,99,0.4)"
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeDasharray="3 4"
          />
        )
      })}
    </AnimatedG>
  )
}

/* One lit line, rendered as a 3-layer filament with its own depth-
 * shifted breath. Per-line component (rather than a .map() body) so
 * each instance owns a hook call to useAnimatedProps — keeping
 * Reanimated's worklet scheduling clean. */
function LitLineFilament({
  idx,
  ax,
  ay,
  bx,
  by,
  breathT,
  depth,
  t,
}: {
  idx: number
  ax: number
  ay: number
  bx: number
  by: number
  breathT: SharedValue<number>
  depth: number
  /** 8 s system clock — drives the travelling cream "particle" that
   *  slides from the A endpoint toward the B endpoint on every lit
   *  edge, reading as energy flowing outward from the alpha. */
  t: SharedValue<number>
}) {
  const gradId = `litLine-${idx}`
  // Same cascade timing as LitStar: each shell brightens 0.02 of the
  // 16 s cycle (~320 ms) after the previous, modulo-wrapped so deep
  // lines in long figures still fire cleanly on the next pass.
  const breathStart = 0.85 + depth * 0.02
  const filamentProps = useAnimatedProps(() => {
    'worklet'
    const bc = (breathT.value - breathStart + 1) % 1
    let breath = 0
    if (bc < 0.1) {
      const local = bc / 0.1
      breath = Math.sin(local * Math.PI) * 0.18
    }
    return { opacity: 0.88 + breath }
  })

  // Travelling beam — a short bright cream dash slides from (ax, ay)
  // toward (bx, by) on every t cycle. Cycle = lineLen + dashLen + gap,
  // so when one dash exits past B it's already invisible (in the gap)
  // when t wraps back to 0 — no jarring snap. Phase offset per-line
  // index so adjacent edges don't all flash at once.
  const lineLen = Math.hypot(bx - ax, by - ay)
  const DASH_LEN = 10
  const GAP_PAD = 22
  const cycle = lineLen + DASH_LEN + GAP_PAD
  const phase = (idx * 0.143) % 1
  const beamProps = useAnimatedProps(() => {
    'worklet'
    const u = (t.value + phase) % 1
    return { strokeDashoffset: -u * cycle }
  })
  // Second beam — same dash period, offset 0.5 of the cycle so the
  // two particles are antipodal: when one is at the A endpoint the
  // other is exiting past B. Reads as "the line is alive with
  // multiple sparks", the Genshin signature for lit-line energy.
  const beamProps2 = useAnimatedProps(() => {
    'worklet'
    const u = (t.value + phase + 0.5) % 1
    return { strokeDashoffset: -u * cycle }
  })
  return (
    <AnimatedG animatedProps={filamentProps}>
      <Defs>
        {/* Gradient runs along the line in user space so it orients
            to A→B, not to the SVG viewBox. Stops are bright at each
            node and dim at the midpoint — each line reads as "two
            stars connected by their own light" rather than a uniform
            stroke. */}
        <LinearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={ax} y1={ay} x2={bx} y2={by}>
          <Stop offset="0%" stopColor="#FFF6E5" stopOpacity={0.85} />
          <Stop offset="15%" stopColor="#D9AE6F" stopOpacity={0.78} />
          <Stop offset="50%" stopColor="#D9AE6F" stopOpacity={0.4} />
          <Stop offset="85%" stopColor="#D9AE6F" stopOpacity={0.78} />
          <Stop offset="100%" stopColor="#FFF6E5" stopOpacity={0.85} />
        </LinearGradient>
      </Defs>
      {/* Three-layer light filament. Recoloured from magenta to
          warm cream-gold so magenta is reserved exclusively for the
          next-to-light action signal; lit lines + stars share one
          earned-progress palette.
          1. Wide diffuse outer bloom — soft gold haze that makes
             the line feel like radiation in fog, not a CAD edge.
          2. Bright gold gradient body — bright at the nodes, faded
             at the midpoint, so each line reads as "two stars
             connected by their own light" rather than a uniform
             stroke.
          3. Hair-thin cream spine — the filament's crisp inner
             thread. This is what makes the line stop reading as
             "ink" and start reading as "a strand of light". */}
      {/* Mega-bloom — widest softest layer. Makes the line GLOW
          radially in space, the way Genshin's constellation lines
          glow. Without this, lit lines read as solid strokes; with
          it, they read as filaments radiating light. */}
      <Line
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke="#D9AE6F"
        strokeOpacity={0.14}
        strokeWidth={12}
        strokeLinecap="round"
      />
      <Line
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke="#D9AE6F"
        strokeOpacity={0.32}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <Line
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke={`url(#${gradId})`}
        strokeWidth={2.8}
        strokeLinecap="round"
      />
      <Line
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke="#FFF6E5"
        strokeOpacity={0.55}
        strokeWidth={0.8}
        strokeLinecap="round"
      />
      {/* Energy beams — two bright cream particles sliding A→B on
          `t`, offset 0.5 of the cycle so they're antipodal. Each
          dasharray sums to the cycle (DASH_LEN + lineLen + GAP_PAD)
          so the bright segment crosses the line once per cycle and
          the gap covers everything else, hiding the loop seam. */}
      <AnimatedLine
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke="#FFF6E5"
        strokeWidth={1.6}
        strokeOpacity={0.85}
        strokeLinecap="round"
        strokeDasharray={`${DASH_LEN} ${lineLen + GAP_PAD}`}
        animatedProps={beamProps}
      />
      <AnimatedLine
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke="#FFF6E5"
        strokeWidth={1.2}
        strokeOpacity={0.6}
        strokeLinecap="round"
        strokeDasharray={`${DASH_LEN * 0.7} ${lineLen + GAP_PAD + DASH_LEN * 0.3}`}
        animatedProps={beamProps2}
      />
    </AnimatedG>
  )
}
