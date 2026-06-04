import { Canvas } from '@shopify/react-native-skia'
import { useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'

import { FullscreenFlash } from './layers/fullscreen-flash'
import { useCelebrationTimeline } from './use-timeline'

/*
 * CelebrateShockwave — the screen-wide gold flash that fires on every
 * upward commit and fades fully back to dark.
 *
 * This file is the COMPOSITION root only. It owns:
 *   • the measured viewport size (onLayout — needed so the Skia
 *     layer can paint at the right pixel extent),
 *   • the master 0 → 1 timeline (via `useCelebrationTimeline`),
 *   • the single Skia <Canvas> that hosts the wash.
 *
 * Just one layer now (`fullscreen-flash`): a flat warm-gold Rect
 * covering the whole viewport, opacity-enveloped. Earlier iterations
 * added concentric layers (radial bloom, diffraction rings) that all
 * created visible edges/center-vs-corners brightness contrast — the
 * flat Rect alone reads as the cleanest "el cuarto se iluminó".
 *
 * The wash reaches 0 at u = 1, so the screen returns to the natural
 * dark sky state — no permanent ambient remains. Reduce-motion is
 * honoured by the CALLER (this component is simply not mounted when
 * motion is reduced).
 *
 * pointerEvents="none" so the wash never blocks taps.
 */

export function CelebrateShockwave({ celebrateKey }: { celebrateKey: number }) {
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const u = useCelebrationTimeline(celebrateKey)

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    if (width !== dims.w || height !== dims.h) setDims({ w: width, h: height })
  }

  if (dims.w <= 0 || dims.h <= 0) {
    return <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout} />
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      <Canvas style={StyleSheet.absoluteFill}>
        <FullscreenFlash u={u} width={dims.w} height={dims.h} />
      </Canvas>
    </View>
  )
}
