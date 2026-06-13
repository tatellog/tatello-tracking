import {
  BlurMask,
  Canvas,
  Circle as SkiaCircle,
  Group as SkiaGroup,
  LinearGradient as SkiaLinearGradient,
  RadialGradient as SkiaRadialGradient,
  Rect as SkiaRect,
  vec,
} from '@shopify/react-native-skia'
import { memo } from 'react'
import { StyleSheet } from 'react-native'
import { useDerivedValue, type SharedValue } from 'react-native-reanimated'

import { colors } from '@/theme'

import { HERO_MAG } from '../../constants'

/*
 * SkiaLitFlareLayer — a volumetric lens-flare crown layered over the
 * existing SVG stars. Same recipe as WeekConstellation's WeekFlareLayer:
 * a Skia <Canvas> absoluteFill-positioned over the constellation SVG
 * adds the parts SVG can't fake — real Gaussian-blurred magenta+cream
 * bloom, additive diffraction rays, a blown-out white core. The SVG
 * stars below provide the crisp body + 4-ray glint; the Skia layer
 * provides the radiant atmosphere around them.
 *
 * Each star breathes on the shared 16 s `breathT` clock, offset by a
 * per-star `phase` so the cluster shimmers in waves rather than in
 * unison. Reduce-motion parks the breath but keeps the bloom drawn.
 *
 * Positioned in CANVAS-pixel space: caller passes pre-computed pixel
 * coords (post SIGN_CONSTELLATION_TRANSFORM, post-canvasSize scale)
 * so this layer stays unaware of the SVG viewBox and just paints.
 */

function rgb(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}
const MAGENTA = rgb(colors.magenta)
const CREAM = rgb(colors.leche)

export type SkiaLit = {
  /** Pixel position in the absoluteFill <Canvas>. */
  x: number
  y: number
  /** Star magnitude — drives base radius. */
  mag: number
}

export const SkiaLitFlareLayer = memo(function SkiaLitFlareLayer({
  lit,
  breathT,
  reduce,
  opacity = 1,
}: {
  lit: SkiaLit[]
  breathT: SharedValue<number>
  reduce: boolean
  /** Atenúa los halos (1 = pleno). El hero lo baja mientras el emblema
   *  se revela, para que el león dorado no compita con el bloom magenta. */
  opacity?: number
}) {
  if (lit.length === 0) return null
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <SkiaGroup opacity={opacity}>
        {lit.map((s, i) => (
          <SkiaFlareNode
            key={`flare-${i}`}
            x={s.x}
            y={s.y}
            mag={s.mag}
            breathT={breathT}
            phase={(i * 0.21) % 1}
            reduce={reduce}
          />
        ))}
      </SkiaGroup>
    </Canvas>
  )
})

function SkiaFlareNode({
  x,
  y,
  mag,
  breathT,
  phase,
  reduce,
}: {
  x: number
  y: number
  mag: number
  breathT: SharedValue<number>
  phase: number
  reduce: boolean
}) {
  const hero = mag <= HERO_MAG
  // Base radius mirrors the geometry.starRadius curve — brighter star
  // (lower mag) → bigger flare. Tuned by eye to read at ~290 px canvas.
  const R = hero ? 6 : Math.max(2.4, 4.6 - mag * 0.55)
  const m = hero ? 1 : 0.6
  const translate = useDerivedValue(() => [{ translateX: x }, { translateY: y }])
  const breathe = useDerivedValue(() => {
    if (reduce) return [{ scale: 1 }]
    const w = 0.5 + 0.5 * Math.sin((breathT.value + phase) * 2 * Math.PI)
    return [{ scale: 0.92 + w * 0.14 }]
  })

  const hueBloomR = R * (hero ? 7.5 : 5)
  const whiteBloomR = R * (hero ? 3.8 : 2.7)

  // Diffraction rays — 6 spokes for hero, 4 for ambient. Alternating
  // long/short so the cross reads as the dominant axis with finer
  // fill spokes between.
  const spikeCount = hero ? 6 : 4
  const rays = Array.from({ length: spikeCount }, (_, i) => {
    const ang = (i * Math.PI * 2) / spikeCount + (((i * 13) % 5) - 2) * 0.04
    const long = i % 2 === 0
    return {
      ang,
      len: R * (long ? (hero ? 7.5 : 4.8) : hero ? 4 : 2.6),
      th: R * 0.22,
      op: (long ? 0.7 : 0.42) * m,
    }
  })

  return (
    <SkiaGroup transform={translate}>
      {/* 1 · Magenta + cream bloom on `screen` so the colours add
          softly without saturating. */}
      <SkiaGroup blendMode="screen" transform={breathe}>
        <SkiaCircle c={vec(0, 0)} r={hueBloomR}>
          <SkiaRadialGradient
            c={vec(0, 0)}
            r={hueBloomR}
            colors={[
              `rgba(${MAGENTA},${0.42 * m})`,
              `rgba(${MAGENTA},${0.14 * m})`,
              `rgba(${MAGENTA},0)`,
            ]}
          />
          <BlurMask blur={R * 3.4} style="normal" />
        </SkiaCircle>
        <SkiaCircle c={vec(0, 0)} r={whiteBloomR}>
          <SkiaRadialGradient
            c={vec(0, 0)}
            r={whiteBloomR}
            colors={[
              `rgba(${CREAM},${0.55 * m})`,
              `rgba(${CREAM},${0.18 * m})`,
              `rgba(${CREAM},0)`,
            ]}
          />
          <BlurMask blur={R * 1.4} style="normal" />
        </SkiaCircle>
      </SkiaGroup>
      {/* 2 · Diffraction rays — additive so the cross reads bright
          where it crosses the bloom. */}
      <SkiaGroup blendMode="plus">
        {rays.map((r, i) => (
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
      {/* 3 · Blown-out white core — a hot pinpoint sitting on top of
          the cream bloom, the "look-at-me" centre of the flare. */}
      <SkiaGroup blendMode="plus">
        <SkiaCircle c={vec(0, 0)} r={R * 1.8}>
          <SkiaRadialGradient
            c={vec(0, 0)}
            r={R * 1.8}
            colors={['rgba(255,255,255,0.78)', 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
          />
          <BlurMask blur={R * 0.85} style="normal" />
        </SkiaCircle>
        <SkiaCircle c={vec(0, 0)} r={R * 0.55} color="white">
          <BlurMask blur={R * 0.22} style="normal" />
        </SkiaCircle>
      </SkiaGroup>
    </SkiaGroup>
  )
}
