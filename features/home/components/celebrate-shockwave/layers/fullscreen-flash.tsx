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
    // Envelope matched to the gold-fireworks Lottie keyframes (at
    // speed 0.6 in Home):
    //   • frame 5  (≈ u 0.05) — Lottie particles burst out → wash peak
    //   • frame 52 (≈ u 0.52) — particles still at 90 % → wash holds peak
    //   • frame 77 (≈ u 0.77) — particles fully faded → wash mid-fade
    //   • frame 100 (u 1.0)   — Lottie layer ends → wash at 0
    //
    // Shape: fast rise → long HOLD at peak → linear decay. Earlier
    // squared-decay shape made the wash disappear by u ≈ 0.4 while
    // the Lottie kept going, breaking the "one component, one
    // rhythm" feel.
    const rise = Math.min(1, v / 0.05)
    // (0.77 - v) / 0.25 ramps from 1 at u=0.52 down to 0 at u=0.77;
    // clamped 0..1 so we hold full peak before u=0.52 and stay at 0
    // after u=0.77 — matching the Lottie's exact visible window
    // (Lottie particles fully faded by frame 77 ≈ u 0.77 at speed 0.6).
    const fall = Math.max(0, Math.min(1, (0.77 - v) / 0.25))
    // Peak 0.65 — solid enough to read as "the screen flashed" and
    // cover the underlying dark/light structure. Higher peak +
    // longer hold matches the Lottie's visual weight.
    return rise * fall * 0.65
  })

  return (
    // Default `srcOver` blend (no `blendMode` prop) — at this peak
    // opacity, `plus` would clip bright pixels (constellation lit
    // stars) to white; `srcOver` lays the gold ON TOP at the given
    // alpha, which gives a uniform tint without saturation cap.
    <SkiaGroup opacity={opacity}>
      <SkiaRect x={0} y={0} width={width} height={height} color={`rgb(${GOLD})`} />
    </SkiaGroup>
  )
}
