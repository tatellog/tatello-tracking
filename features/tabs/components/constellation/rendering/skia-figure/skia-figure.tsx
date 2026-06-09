import { BlurMask, Canvas, Circle, Group, Path } from '@shopify/react-native-skia'
import { memo } from 'react'
import { StyleSheet } from 'react-native'
import { useDerivedValue, type SharedValue } from 'react-native-reanimated'

import { colors } from '@/theme'

import { fourPointStarPath, starRadius } from '../../geometry'
import type { Resolved, SequenceEl } from '../../types'

/*
 * SkiaFigure — the constellation FIGURE (lines + star bodies) drawn in a
 * single Skia <Canvas> instead of react-native-svg.
 *
 * WHY: on Android RNSVG redraws the entire <Svg> tree on every animated
 * child, so the figure's many nodes (sparkles, halos, lines) re-rasterise
 * 60×/s. Skia is GPU-accelerated and draws each node cheaply — the same
 * visuals, far lighter. The art (already a PNG) and the lit-star bloom
 * (SkiaLitFlareLayer) are handled elsewhere; this layer carries the bodies.
 *
 * SLICE 1 (this file): lines + 4-point star bodies for placeholder / lit /
 * next stars, with the opacity twinkle. Layered halos, recency fade, the
 * cascade breath, ignition + particles land in later slices — this proves
 * the coordinate mapping and the look match the SVG figure.
 *
 * Coordinates: the caller passes `toScreen` (viewBox → canvas px, already
 * folding SIGN_CONSTELLATION_TRANSFORM) and `sScale` (= sx·k) so radii and
 * stroke widths scale exactly like the SVG <G transform> did.
 */

const CREAM = colors.leche
const MAGENTA = colors.magenta

type Px = { x: number; y: number; r: number; mag: number }

export const SkiaFigure = memo(function SkiaFigure({
  stars,
  lines,
  litKeys,
  nextEl,
  toScreen,
  sScale,
  t,
  reduce,
}: {
  stars: Resolved[]
  lines: readonly (readonly [number, number])[]
  litKeys: Set<string>
  nextEl: SequenceEl | null
  toScreen: (xVb: number, yVb: number) => { x: number; y: number }
  sScale: number
  t: SharedValue<number>
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
        return (
          <SkiaStar
            key={`s-${i}`}
            p={p}
            i={i}
            isLit={isLit}
            isNext={isNext}
            sScale={sScale}
            t={t}
            reduce={reduce}
          />
        )
      })}
    </Canvas>
  )
})

function SkiaStar({
  p,
  i,
  isLit,
  isNext,
  sScale,
  t,
  reduce,
}: {
  p: Px
  i: number
  isLit: boolean
  isNext: boolean
  sScale: number
  t: SharedValue<number>
  reduce: boolean
}) {
  const bright = isLit || isNext
  const phase = (i * 0.137) % 1

  // Opacity twinkle — same scintillation recipe as the SVG figure: a slow
  // breath wave plus a brief async dip per star. Lit/next stars rest bright,
  // placeholders rest faint.
  const opacity = useDerivedValue(() => {
    if (reduce) return bright ? 0.95 : 0.4
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    const cycle = (t.value * 2.4 + i * 0.31) % 1
    const dip = bright ? 0.35 : 0.58
    let tk = 1
    if (cycle < 0.04) tk = 1 - (cycle / 0.04) * dip
    else if (cycle < 0.08) tk = 1 - dip + ((cycle - 0.04) / 0.04) * dip
    const base = bright ? 0.85 + 0.15 * wave : 0.32 + 0.1 * wave
    const o = base * tk
    return o > 1 ? 1 : o
  })

  const body = fourPointStarPath(p.x, p.y, p.r)

  return (
    <Group opacity={opacity}>
      {bright ? (
        <Circle
          cx={p.x}
          cy={p.y}
          r={p.r + 5 * sScale}
          color={MAGENTA}
          opacity={isNext ? 0.5 : 0.32}
        >
          <BlurMask blur={p.r * 0.9} style="normal" />
        </Circle>
      ) : null}
      <Path path={body} color={isNext ? MAGENTA : CREAM} />
    </Group>
  )
}
