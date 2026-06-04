import { Canvas } from '@shopify/react-native-skia'
import { useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'

import { CentreBloom } from './layers/centre-bloom'
import { FullscreenFlash } from './layers/fullscreen-flash'
import { useCelebrationTimeline } from './use-timeline'

/*
 * CelebrateShockwave — the screen-wide gold flash that fires on every
 * upward commit and fades fully back to dark.
 *
 * This file is the COMPOSITION root only. It owns:
 *   • the measured viewport size (onLayout — needed so each Skia
 *     layer can paint at the right scale),
 *   • the master 0 → 1 timeline (via `useCelebrationTimeline`),
 *   • the single Skia <Canvas> that hosts the two layers.
 *
 * The visual concerns live in `./layers/`:
 *   1. fullscreen-flash — flat warm-gold Rect covering the whole
 *      viewport, opacity-enveloped. The "el cuarto se iluminó" wash.
 *   2. centre-bloom     — small radial bloom centred on the card
 *      that gives the flash a sense of light source (originates
 *      FROM the constellation, not nowhere).
 *
 * Both layers reach 0 at u = 1, so the screen returns to the natural
 * dark sky state — no permanent ambient remains. Reduce-motion is
 * honoured by the CALLER (this component is simply not mounted when
 * motion is reduced).
 *
 * NOTE: a third "diffraction rings" layer was tried earlier and
 * removed — the expanding cream strokes read as visible diana/ring
 * shapes against the dark sky instead of "shockwave". A flat
 * fullscreen wash + warm centre give the same celebratory weight
 * without any visible edges.
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

  const cx = dims.w / 2
  // 42 % vertical matches the constellation card's centre on a phone
  // — the centre bloom emanates from the asterism, not from the
  // geometric centre of the device.
  const cy = dims.h * 0.42
  const minSide = Math.min(dims.w, dims.h)

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      <Canvas style={StyleSheet.absoluteFill}>
        <FullscreenFlash u={u} width={dims.w} height={dims.h} />
        <CentreBloom u={u} cx={cx} cy={cy} minSide={minSide} />
      </Canvas>
    </View>
  )
}
