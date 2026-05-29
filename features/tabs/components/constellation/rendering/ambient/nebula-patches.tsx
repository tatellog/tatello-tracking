import { memo } from 'react'
import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { Ellipse, G } from 'react-native-svg'

import { AnimatedG } from '../../animation/animated-components'
import { H, NEBULA_LAYERS, W } from '../../constants'

/* ─ Nebula patches — directional immersive sky ───────────────────
 *
 * Four off-centre ellipse stacks that build a Genshin-style deep
 * cosmic backdrop. Each patch is a stack of layered ellipses that
 * dodges the iOS RadialGradient alpha-stop bug:
 *
 *  • WARM    — magenta-granate, biased to the alpha quadrant.
 *              The gas the brightest star illuminates.
 *  • COOL    — dark ciruela/violet, opposite quadrant.
 *              The cold half of the sky.
 *  • DEEP    — concentrated magenta haze near the centre.
 *              Focal warmth where the constellation lives.
 *  • BRONZE  — warm gold haze offset to the upper-right.
 *              Ties the bronze lion engraving into the atmosphere.
 *
 * Each patch drifts on its own phase so the sky reads as weather,
 * not a synchronised loop.
 */
export const NebulaPatches = memo(function NebulaPatches({
  ax,
  ay,
  drift,
}: {
  ax: number
  ay: number
  /** 60 s loop. Drives the slow translate of all patches so the
   *  sky drifts like clouds in a long exposure. */
  drift: SharedValue<number>
}) {
  const cx = W / 2
  const cy = H / 2
  const wx = cx + (ax - cx) * 0.6
  const wy = cy + (ay - cy) * 0.6
  const ccx = cx - (wx - cx)
  const ccy = cy - (wy - cy)
  // Bronze patch — biased opposite to the cool, in the warm-gold
  // upper-right quadrant where the lion's mane wraps.
  const bx = cx + 60
  const by = cy - 40

  // Four phase-shifted drift vectors. Different amplitudes + phase
  // offsets so no two patches travel in lockstep. Each patch also
  // breathes brightness on its own long cycle so the nebula feels
  // like weather, not a layered loop — clouds catching variable
  // light from off-screen sources.
  const warmDrift = useAnimatedProps(() => {
    'worklet'
    const a = drift.value * 2 * Math.PI
    const breath = 0.5 + 0.5 * Math.sin(drift.value * 2 * Math.PI * 0.7)
    return {
      transform: [{ translateX: Math.sin(a) * 22 }, { translateY: Math.cos(a) * 14 }],
      opacity: 0.65 + 0.35 * breath,
    }
  })
  const coolDrift = useAnimatedProps(() => {
    'worklet'
    const a = drift.value * 2 * Math.PI + Math.PI * 0.7
    const breath = 0.5 + 0.5 * Math.sin(drift.value * 2 * Math.PI * 0.45 + Math.PI * 0.4)
    return {
      transform: [{ translateX: Math.sin(a) * 18 }, { translateY: Math.cos(a) * 24 }],
      opacity: 0.55 + 0.45 * breath,
    }
  })
  const deepDrift = useAnimatedProps(() => {
    'worklet'
    const a = drift.value * 2 * Math.PI + Math.PI * 1.3
    const breath = 0.5 + 0.5 * Math.sin(drift.value * 2 * Math.PI * 0.55 + Math.PI * 1.1)
    return {
      transform: [{ translateX: Math.sin(a) * 10 }, { translateY: Math.cos(a) * 8 }],
      opacity: 0.6 + 0.4 * breath,
    }
  })
  const bronzeDrift = useAnimatedProps(() => {
    'worklet'
    const a = drift.value * 2 * Math.PI + Math.PI * 0.35
    const breath = 0.5 + 0.5 * Math.sin(drift.value * 2 * Math.PI * 0.85 + Math.PI * 0.6)
    return {
      transform: [{ translateX: Math.sin(a) * 16 }, { translateY: Math.cos(a) * 12 }],
      opacity: 0.5 + 0.5 * breath,
    }
  })

  return (
    <G>
      <AnimatedG animatedProps={warmDrift}>
        {Array.from({ length: NEBULA_LAYERS }).map((_, i) => {
          const tt = i / (NEBULA_LAYERS - 1)
          const rx = 195 - 140 * tt
          const ry = rx * 0.78
          const op = 0.018 + tt * 0.04
          return (
            <Ellipse key={`nw-${i}`} cx={wx} cy={wy} rx={rx} ry={ry} fill="#5A1438" opacity={op} />
          )
        })}
      </AnimatedG>
      <AnimatedG animatedProps={coolDrift}>
        {Array.from({ length: NEBULA_LAYERS }).map((_, i) => {
          const tt = i / (NEBULA_LAYERS - 1)
          const rx = 165 - 115 * tt
          const ry = rx * 1.18
          const op = 0.013 + tt * 0.025
          return (
            <Ellipse
              key={`nc-${i}`}
              cx={ccx}
              cy={ccy}
              rx={rx}
              ry={ry}
              fill="#2A1838"
              opacity={op}
            />
          )
        })}
      </AnimatedG>
      <AnimatedG animatedProps={deepDrift}>
        {Array.from({ length: NEBULA_LAYERS }).map((_, i) => {
          const tt = i / (NEBULA_LAYERS - 1)
          const rx = 130 - 95 * tt
          const ry = rx * 0.92
          const op = 0.014 + tt * 0.035
          return (
            <Ellipse key={`nd-${i}`} cx={cx} cy={cy} rx={rx} ry={ry} fill="#A6164A" opacity={op} />
          )
        })}
      </AnimatedG>
      <AnimatedG animatedProps={bronzeDrift}>
        {Array.from({ length: NEBULA_LAYERS }).map((_, i) => {
          const tt = i / (NEBULA_LAYERS - 1)
          const rx = 110 - 75 * tt
          const ry = rx * 1.05
          // Warm bronze tone — ties to the lion engraving's palette.
          const op = 0.009 + tt * 0.018
          return (
            <Ellipse key={`nb-${i}`} cx={bx} cy={by} rx={rx} ry={ry} fill="#7A5A38" opacity={op} />
          )
        })}
      </AnimatedG>
    </G>
  )
})
