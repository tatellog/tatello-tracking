import { BlurMask, Canvas, Circle, Group, Path } from '@shopify/react-native-skia'
import { memo } from 'react'
import { StyleSheet } from 'react-native'
import { useDerivedValue, type SharedValue } from 'react-native-reanimated'

import { colors } from '@/theme'

import { HERO_MAG } from '../../constants'
import { fourPointStarPath, recencyHaloMultiplier, starRadius } from '../../geometry'
import type { Resolved, SequenceEl } from '../../types'

/*
 * SkiaFigure — the constellation FIGURE (lines + star bodies + halos) drawn
 * in a single Skia <Canvas> instead of react-native-svg.
 *
 * WHY: on Android RNSVG redraws the entire <Svg> tree on every animated
 * child, so the figure's many nodes re-rasterise 60×/s. Skia is GPU and
 * draws each node cheaply — same visuals, far lighter. The art (a PNG) and
 * the lit-star magenta bloom (SkiaLitFlareLayer) live elsewhere; this layer
 * carries the lines, the star bodies and their layered cream/gold halos.
 *
 * SLICE 2: lines + bodies (placeholder / lit / next) + the layered lit-star
 * halos (outer gold, main cream, core, white-hot) with recency fade + cascade
 * breath, + the hero glow on alpha stars. Still pending: ignition animation,
 * rising particles, today ring, lit-cluster aura, the commit litPulse ripple.
 *
 * Coordinates: caller passes `toScreen` (viewBox → canvas px, folding
 * SIGN_CONSTELLATION_TRANSFORM) and `sScale` (= sx·k) so radii / strokes /
 * halo offsets scale exactly like the SVG <G transform> did.
 */

const CREAM = colors.leche // #F4ECDE
const CREAM_HOT = colors.oroLeche // #FFF6E5
const GOLD = colors.oro // #D9AE6F
const MAGENTA = colors.magenta
const WHITE_HOT = '#FFF1D6'

type Px = { x: number; y: number; r: number; mag: number }

export const SkiaFigure = memo(function SkiaFigure({
  stars,
  lines,
  litKeys,
  nextEl,
  starRecency,
  starDepth,
  toScreen,
  sScale,
  t,
  breathT,
  reduce,
}: {
  stars: Resolved[]
  lines: readonly (readonly [number, number])[]
  litKeys: Set<string>
  nextEl: SequenceEl | null
  starRecency: Map<number, number>
  starDepth: Map<number, number>
  toScreen: (xVb: number, yVb: number) => { x: number; y: number }
  sScale: number
  t: SharedValue<number>
  breathT: SharedValue<number>
  reduce: boolean
}) {
  const px: Px[] = stars.map((s) => {
    const p = toScreen(s.x, s.y)
    return { x: p.x, y: p.y, r: starRadius(s.mag) * sScale, mag: s.mag }
  })

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map(([a, b], idx) => {
        const A = px[a]
        const B = px[b]
        if (!A || !B) return null
        const lit = litKeys.has(`line-${idx}`)
        return (
          <Path
            key={`l-${idx}`}
            path={`M${A.x.toFixed(1)},${A.y.toFixed(1)}L${B.x.toFixed(1)},${B.y.toFixed(1)}`}
            color={CREAM}
            style="stroke"
            strokeWidth={(lit ? 1.4 : 2.6) * sScale}
            strokeCap="round"
            opacity={lit ? 0.7 : 0.28}
          />
        )
      })}
      {px.map((p, i) => {
        const isLit = litKeys.has(`star-${i}`)
        const isNext = nextEl?.type === 'star' && nextEl.idx === i
        if (isNext)
          return <SkiaNextStar key={`s-${i}`} p={p} sScale={sScale} t={t} reduce={reduce} />
        if (isLit)
          return (
            <SkiaLitStar
              key={`s-${i}`}
              p={p}
              i={i}
              recency={starRecency.get(i) ?? 0}
              depth={starDepth.get(i) ?? 0}
              sScale={sScale}
              t={t}
              breathT={breathT}
              reduce={reduce}
            />
          )
        return <SkiaPlaceholderStar key={`s-${i}`} p={p} i={i} t={t} reduce={reduce} />
      })}
    </Canvas>
  )
})

/* Soft multi-layer bloom for the alpha (hero) stars — 4 stacked discs that
 * breathe scale + opacity. Matches figure-base/HeroGlow. */
function HeroGlow({
  p,
  phase,
  t,
  reduce,
}: {
  p: Px
  phase: number
  t: SharedValue<number>
  reduce: boolean
}) {
  const groupOpacity = useDerivedValue(() => {
    if (reduce) return 0.6
    const wave = 0.5 + 0.5 * Math.sin((t.value * 2 + phase) * 2 * Math.PI)
    return 0.45 + wave * 0.3
  })
  const transform = useDerivedValue(() => {
    const wave = reduce ? 0.5 : 0.5 + 0.5 * Math.sin((t.value * 2 + phase) * 2 * Math.PI)
    const scale = 1 + wave * 0.12
    return [
      { translateX: p.x },
      { translateY: p.y },
      { scale },
      { translateX: -p.x },
      { translateY: -p.y },
    ]
  })
  return (
    <Group opacity={groupOpacity} transform={transform}>
      <Circle cx={p.x} cy={p.y} r={p.r * 3.6} color={GOLD} opacity={0.04} />
      <Circle cx={p.x} cy={p.y} r={p.r * 2.6} color={GOLD} opacity={0.07} />
      <Circle cx={p.x} cy={p.y} r={p.r * 1.8} color={CREAM} opacity={0.12} />
      <Circle cx={p.x} cy={p.y} r={p.r * 1.2} color={CREAM_HOT} opacity={0.22} />
    </Group>
  )
}

function SkiaPlaceholderStar({
  p,
  i,
  t,
  reduce,
}: {
  p: Px
  i: number
  t: SharedValue<number>
  reduce: boolean
}) {
  const isHero = p.mag <= HERO_MAG
  const phase = (i * 0.137) % 1
  const opacity = useDerivedValue(() => {
    if (reduce) return 0.4
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    const cycle = (t.value * 2.4 + i * 0.31) % 1
    let tk = 1
    if (cycle < 0.04) tk = 1 - (cycle / 0.04) * 0.58
    else if (cycle < 0.08) tk = 0.42 + ((cycle - 0.04) / 0.04) * 0.58
    const o = (0.32 + 0.1 * wave) * tk
    return o > 1 ? 1 : o
  })
  return (
    <>
      {isHero ? <HeroGlow p={p} phase={phase} t={t} reduce={reduce} /> : null}
      <Group opacity={opacity}>
        <Path path={fourPointStarPath(p.x, p.y, p.r)} color={CREAM} />
      </Group>
    </>
  )
}

function SkiaLitStar({
  p,
  i,
  recency,
  depth,
  sScale,
  t,
  breathT,
  reduce,
}: {
  p: Px
  i: number
  recency: number
  depth: number
  sScale: number
  t: SharedValue<number>
  breathT: SharedValue<number>
  reduce: boolean
}) {
  const isHero = p.mag <= HERO_MAG
  const phase = (i * 0.137) % 1
  const haloMult = recencyHaloMultiplier(recency)
  const breathStart = 0.85 + depth * 0.02

  // Cascade breath pulse shared by the halos — alpha first, each shell ~320 ms
  // later, radiating outward (matches lit-star.tsx).
  const cascade = useDerivedValue(() => {
    if (reduce) return 0
    const bc = (breathT.value - breathStart + 1) % 1
    return bc < 0.1 ? Math.sin((bc / 0.1) * Math.PI) : 0
  })
  const wave = useDerivedValue(() =>
    reduce ? 1 : 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI),
  )

  const outerHaloOpacity = useDerivedValue(() => (0.025 + 0.02 * wave.value) * haloMult)
  const outerHaloR = useDerivedValue(() => p.r + 9 * haloMult * sScale)
  const mainHaloOpacity = useDerivedValue(
    () => (0.08 + 0.08 * wave.value) * haloMult + cascade.value * 0.12 * haloMult,
  )
  const mainHaloR = useDerivedValue(() => p.r + 7 * haloMult * sScale + cascade.value * 12 * sScale)
  const coreOpacity = useDerivedValue(() => (0.35 + 0.2 * wave.value) * haloMult)
  const coreR = useDerivedValue(() => p.r + 2 * sScale + wave.value * 1.2 * sScale)

  // Body twinkle (cream sparkle).
  const bodyOpacity = useDerivedValue(() => {
    if (reduce) return 0.95
    const w = wave.value
    const cycle = (t.value * 2.4 + i * 0.31) % 1
    let tk = 1
    if (cycle < 0.04) tk = 1 - (cycle / 0.04) * 0.35
    else if (cycle < 0.08) tk = 0.65 + ((cycle - 0.04) / 0.04) * 0.35
    const o = (0.85 + 0.15 * w) * tk
    return o > 1 ? 1 : o
  })

  return (
    <>
      {isHero ? <HeroGlow p={p} phase={phase} t={t} reduce={reduce} /> : null}
      {/* Outer diffuse gold halo */}
      <Circle cx={p.x} cy={p.y} r={outerHaloR} color={GOLD} opacity={outerHaloOpacity} />
      {/* Main cream halo (the Skia flare layer adds the magenta bloom) */}
      <Circle cx={p.x} cy={p.y} r={mainHaloR} color={CREAM_HOT} opacity={mainHaloOpacity} />
      {/* Hot core */}
      <Circle cx={p.x} cy={p.y} r={coreR} color={CREAM_HOT} opacity={coreOpacity} />
      {/* Body sparkle */}
      <Group opacity={bodyOpacity}>
        <Path path={fourPointStarPath(p.x, p.y, p.r)} color={CREAM_HOT} />
      </Group>
      {/* White-hot pinpoint */}
      <Circle cx={p.x} cy={p.y} r={Math.max(0.5, p.r * 0.16)} color={WHITE_HOT} opacity={0.75} />
    </>
  )
}

function SkiaNextStar({
  p,
  sScale,
  t,
  reduce,
}: {
  p: Px
  sScale: number
  t: SharedValue<number>
  reduce: boolean
}) {
  // Breathing magenta halo — the "next to ignite" affordance. Swells ~every 3s.
  const haloOpacity = useDerivedValue(() => {
    if (reduce) return 0.5
    const w = 0.5 + 0.5 * Math.sin(t.value * (8 / 3) * 2 * Math.PI)
    return 0.32 + w * 0.28
  })
  const haloR = useDerivedValue(() => {
    const w = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(t.value * (8 / 3) * 2 * Math.PI)
    return p.r + (4 + w * 4) * sScale
  })
  return (
    <>
      <Circle cx={p.x} cy={p.y} r={haloR} color={MAGENTA} opacity={haloOpacity}>
        <BlurMask blur={p.r * 0.7} style="normal" />
      </Circle>
      <Path path={fourPointStarPath(p.x, p.y, p.r)} color={MAGENTA} />
    </>
  )
}
