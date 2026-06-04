import LottieView from 'lottie-react-native'
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'

/*
 * LottieIgnitionBurst — a one-shot `gold-fireworks.json` Lottie played
 * at the position of the star currently igniting. Reuses the same asset
 * the Home commit reward fires (so the visual language stays consistent),
 * but scoped: small (~32 % of canvas) and centred on the star instead of
 * filling the whole canvas.
 *
 * Layered behind IgnitingStar's SVG diffraction cross + burst sparks
 * so the gold particle wash backs the dramatic cross instead of fighting
 * it. The `key` (re-mounted on every ignition via `igniteKey` from the
 * caller) ensures Lottie replays cleanly each time.
 *
 * Reduce-motion is honoured upstream — the caller doesn't mount this
 * component at all when motion is reduced.
 */

const FIREWORK = require('@/assets/lottie/gold-fireworks.json')

export type IgnitionPos = {
  /** Pre-computed pixel position relative to the parent View. */
  x: number
  y: number
}

export const LottieIgnitionBurst = memo(function LottieIgnitionBurst({
  pos,
  size,
  igniteKey,
}: {
  pos: IgnitionPos
  /** Pixel diameter for the Lottie square. ≈ canvas * 0.32 reads as
   *  a personal halo around the star without overwhelming neighbours. */
  size: number
  /** Remounts the LottieView so it autoplays from frame 0 each ignite. */
  igniteKey: string
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          left: pos.x - size / 2,
          top: pos.y - size / 2,
          width: size,
          height: size,
        },
      ]}
    >
      <LottieView
        key={igniteKey}
        source={FIREWORK}
        autoPlay
        loop={false}
        speed={1.6}
        resizeMode="contain"
        style={StyleSheet.absoluteFill}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
  },
})
