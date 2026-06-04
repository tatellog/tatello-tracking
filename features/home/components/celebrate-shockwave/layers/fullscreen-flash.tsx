import { Group as SkiaGroup, Rect as SkiaRect } from '@shopify/react-native-skia'
import { useDerivedValue, type SharedValue } from 'react-native-reanimated'

import { GOLD } from '../palette'

/*
 * Layer 1 — the SCREEN-WIDE warm gold flash. A flat <Rect> covering
 * the full viewport with a solid warm gold colour, driven entirely by
 * an opacity envelope. This is the "el cuarto se iluminó" moment: the
 * room itself goes warm gold, then washes back to dark.
 *
 * Earlier iterations used a radial gradient + diffraction rings on top
 * — they read as visible diana/ring shapes (the gradient falloff
 * cropped at screen edges, the rings drew crisp circles). Flat colour
 * removes both: the whole screen brightens uniformly, no edges.
 *
 * Asymmetric envelope: snaps to peak by u ≈ 0.10 (≈170 ms with
 * ease-out cubic), then decays as (1-u)² for a long, soft fade. Peak
 * alpha 0.42 reads as "the screen flashed gold" without obscuring
 * the constellation underneath. Reaches exactly 0 at u = 1, so no
 * permanent ambient remains.
 */

export function FullscreenFlash({
  u,
  width,
  height,
}: {
  u: SharedValue<number>
  /** Full viewport dimensions in px — the Rect covers all of it. */
  width: number
  height: number
}) {
  const opacity = useDerivedValue(() => {
    const v = u.value
    const rise = Math.min(1, v / 0.1)
    const fall = Math.max(0, 1 - (v - 0.1) / 0.9)
    return rise * fall * fall * 0.42
  })

  return (
    <SkiaGroup opacity={opacity}>
      <SkiaRect x={0} y={0} width={width} height={height} color={`rgb(${GOLD})`} />
    </SkiaGroup>
  )
}
