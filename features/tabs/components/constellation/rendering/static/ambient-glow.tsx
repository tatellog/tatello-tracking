import { memo } from 'react'
import { Ellipse, G } from 'react-native-svg'

import { colors } from '@/theme'

import {
  AMBIENT_ASPECT,
  AMBIENT_LAYERS,
  AMBIENT_PER_LAYER_ALPHA,
  AMBIENT_RX_MAX,
  AMBIENT_RX_MIN,
} from '../../constants'

/* Persistent magenta ambient wash that sits behind the constellation
 * at rest — the "this is where your figure lives" mood light.
 *
 * 12 concentric ellipses with uniform low alpha and uniform radial
 * spacing fake a radial gradient without using <RadialGradient> (which
 * has known iOS issues with alpha stops in react-native-svg). With
 * this many layers, no individual edge is perceptible — the eye reads
 * a smooth falloff. Each layer adds the same alpha increment, so the
 * accumulated opacity falls linearly from ~0.26 at the centre to ~0
 * at the outer rim. Horizontal aspect ~1.45 : 1 matches the
 * constellation's typical spread.
 *
 * Static — no animation — so the eye reads it as the scene's lighting,
 * not as an effect. */
export const AmbientGlow = memo(function AmbientGlow({ cx, cy }: { cx: number; cy: number }) {
  return (
    <G>
      {Array.from({ length: AMBIENT_LAYERS }).map((_, i) => {
        const tt = i / (AMBIENT_LAYERS - 1)
        const rx = AMBIENT_RX_MAX - (AMBIENT_RX_MAX - AMBIENT_RX_MIN) * tt
        const ry = rx / AMBIENT_ASPECT
        return (
          <Ellipse
            key={i}
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fill={colors.magenta}
            opacity={AMBIENT_PER_LAYER_ALPHA}
          />
        )
      })}
    </G>
  )
})
