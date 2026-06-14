import { useEffect, useState } from 'react'
import {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

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
 * image, just dissolving"; then over 400 ms after canvasReady
 * the wrapper opacity drops to 0 so the constellation + art comes
 * into sharp focus. (Was 700 ms — the BlurView composites every
 * frame of the fade, so the longer window cost ~40 % more GPU on
 * the reveal; the skeleton already clears in ~320 ms, so 400 ms
 * keeps them overlapping and the shorter fade is imperceptible.)
 * The BlurView's `intensity` stays FIXED at 18
 * (animating intensity in expo-blur is expensive on iOS because
 * UIVisualEffectView re-composes its layer every frame); we fade
 * the layer above by opacity instead, which the GPU can do as a
 * cheap composite property. When the fade ends, blurMounted flips
 * to false and the BlurView unmounts — zero ongoing GPU cost.
 */

export function useCanvasReveal(): {
  canvasReady: boolean
  blurMounted: boolean
  blurStyle: ReturnType<typeof useAnimatedStyle>
} {
  const [canvasReady, setCanvasReady] = useState(false)
  const [blurMounted, setBlurMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setCanvasReady(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  const blurOpacity = useSharedValue(1)
  useEffect(() => {
    if (!canvasReady) return
    setBlurMounted(true)
    blurOpacity.value = 1
    blurOpacity.value = withTiming(
      0,
      { duration: 400, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setBlurMounted)(false)
      },
    )
  }, [canvasReady, blurOpacity])

  const blurStyle = useAnimatedStyle(() => ({
    opacity: blurOpacity.value,
  }))

  return { canvasReady, blurMounted, blurStyle }
}
