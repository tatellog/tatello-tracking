import { useEffect, useState } from 'react'
import { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated'

/* ─ Canvas reveal ──────────────────────────────────────────────────
 *
 * The zodiac-art SVG (a react-native-svg-transformer component
 * nested inside our parent <Svg>) mis-sizes on the very first
 * paint — it briefly renders at its file's intrinsic 1254 × 1254
 * before honouring the width/height props, leaving the art
 * clipped to the canvas's top-left for one frame. Hold the canvas
 * behind the skeleton for 1000 ms so (a) the nested Svg has
 * settled, and (b) the skeleton's drawing animation completes
 * one full pass before we fade the real composition in — the
 * user reads "the cosmos was plotted", then the real sign appears.
 *
 * Rack-focus blur on the real Svg. The Svg is born matching the
 * skeleton's blur intensity (18) so the cross-fade reads "same
 * image, just dissolving"; then over 700 ms after canvasReady
 * the blur drains to 0 so the constellation + art comes into
 * sharp focus. Without this the cross-fade jumps from BLURRED
 * (skeleton) to SHARP (Svg) and the eye reads two visual
 * registers instead of one continuous transition.
 */

export function useCanvasReveal(): {
  canvasReady: boolean
  revealBlurProps: ReturnType<typeof useAnimatedProps>
} {
  const [canvasReady, setCanvasReady] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setCanvasReady(true), 1500)
    return () => clearTimeout(timer)
  }, [])
  const revealBlur = useSharedValue(18)
  useEffect(() => {
    if (!canvasReady) return
    revealBlur.value = withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) })
  }, [canvasReady, revealBlur])
  const revealBlurProps = useAnimatedProps(() => ({
    intensity: revealBlur.value,
  }))
  return { canvasReady, revealBlurProps }
}
