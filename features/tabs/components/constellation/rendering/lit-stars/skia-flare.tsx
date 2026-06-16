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
  reveal,
  reduce,
  opacity = 1,
}: {
  lit: SkiaLit[]
  breathT: SharedValue<number>
  /** Reveal 0→1 — el bloom de cada estrella entra junto al "despertar" de la
   *  figura (no antes), durante la fase temprana del reveal. */
  reveal: SharedValue<number>
  reduce: boolean
  /** Atenúa los halos (1 = pleno). El hero lo baja mientras el emblema
   *  se revela, para que el león dorado no compita con el bloom magenta. */
  opacity?: number
}) {
  // El bloom acompaña el despertar de las estrellas: rampa de opacidad sobre
  // [0.1, 0.6] del reveal (≈ fase de "despiertan estrellas"), así no aparece el
  // halo antes que el cuerpo de la estrella.
  const groupOpacity = useDerivedValue(() => {
    if (reduce) return opacity
    const r = (reveal.value - 0.1) / 0.5
    return opacity * (r < 0 ? 0 : r > 1 ? 1 : r)
  })
  if (lit.length === 0) return null
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <SkiaGroup opacity={groupOpacity}>
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
  // Hero un poco más chico (5) para que el halo no se derrame sobre el
  // cuerpo del emblema dorado de fondo.
  const R = hero ? 5.4 : Math.max(2.6, 4.9 - mag * 0.55)
  const m = hero ? 1 : 0.62
  const translate = useDerivedValue(() => [{ translateX: x }, { translateY: y }])
  const breathe = useDerivedValue(() => {
    if (reduce) return [{ scale: 1 }]
    const w = 0.5 + 0.5 * Math.sin((breathT.value + phase) * 2 * Math.PI)
    return [{ scale: 0.92 + w * 0.14 }]
  })

  const hueBloomR = R * (hero ? 9.5 : 6)
  const whiteBloomR = R * (hero ? 3.8 : 2.7)

  // Diffraction rays — estilo Genshin: cruces de difracción LARGAS y finas que
  // dominan, con spokes cortos de relleno entre ellas. Subidas en largo +
  // brillo (y un pelín más finas) para que las estrellas sean el foco y las
  // líneas lean como energía sutil entre ellas.
  const spikeCount = hero ? 6 : 4
  const rays = Array.from({ length: spikeCount }, (_, i) => {
    const ang = (i * Math.PI * 2) / spikeCount + (((i * 13) % 5) - 2) * 0.04
    const long = i % 2 === 0
    return {
      ang,
      len: R * (long ? (hero ? 10.5 : 7) : hero ? 5.5 : 3.8),
      th: R * 0.2,
      op: (long ? 0.82 : 0.5) * m,
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
              `rgba(${MAGENTA},${0.5 * m})`,
              `rgba(${MAGENTA},${0.16 * m})`,
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
            colors={['rgba(255,255,255,0.48)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']}
          />
          <BlurMask blur={R * 0.85} style="normal" />
        </SkiaCircle>
        <SkiaCircle c={vec(0, 0)} r={R * 0.42} color={colors.leche}>
          <BlurMask blur={R * 0.22} style="normal" />
        </SkiaCircle>
      </SkiaGroup>
    </SkiaGroup>
  )
}
