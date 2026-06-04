import {
  BlurMask,
  Circle as SkiaCircle,
  Group as SkiaGroup,
  RadialGradient as SkiaRadialGradient,
  vec,
} from '@shopify/react-native-skia'
import { useDerivedValue, type SharedValue } from 'react-native-reanimated'

import { CREAM, GOLD, MAGENTA } from '../palette'

/*
 * Layer 2 — the DIRECTIONAL bloom centred on the constellation card.
 * Sits on top of the flat fullscreen flash and gives it a sense of
 * "light source" (the warmth originates FROM the constellation, not
 * from the geometric centre of the device).
 *
 * Circle radius is FIXED at the gradient extent so the carrier shape
 * never cuts the gradient (which would draw a visible edge / ring).
 * All visual change comes from the opacity envelope: asymmetric rise
 * peaking at u ≈ 0.18, then quadratic decay to 0 at u = 1.
 *
 * Heavy BlurMask + a small inner-stop bias keep the bloom feeling
 * like atmospheric light, not a coloured disc.
 */

export function CentreBloom({
  u,
  cx,
  cy,
  minSide,
}: {
  u: SharedValue<number>
  cx: number
  cy: number
  /** min(screen.w, screen.h) — keeps the bloom proportional to the
   *  short edge so portrait and landscape both read the same. */
  minSide: number
}) {
  // Gradient extent — also serves as the circle radius so the full
  // gradient renders to its zero-alpha edge (no carrier-shape cut).
  const R = minSide * 0.8

  const opacity = useDerivedValue(() => {
    const v = u.value
    const rise = Math.min(1, v / 0.18)
    const fall = Math.max(0, 1 - (v - 0.18) / 0.82)
    return rise * fall * fall * 0.7
  })

  return (
    <SkiaGroup blendMode="screen">
      <SkiaCircle cx={cx} cy={cy} r={R} opacity={opacity}>
        <SkiaRadialGradient
          c={vec(cx, cy)}
          r={R}
          colors={[
            `rgba(${CREAM},0.7)`,
            `rgba(${GOLD},0.35)`,
            `rgba(${MAGENTA},0.1)`,
            `rgba(${MAGENTA},0)`,
          ]}
          positions={[0, 0.45, 0.85, 1]}
        />
        <BlurMask blur={36} style="normal" />
      </SkiaCircle>
    </SkiaGroup>
  )
}
