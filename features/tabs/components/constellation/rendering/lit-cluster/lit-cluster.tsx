import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { G } from 'react-native-svg'

import { AnimatedCircle } from '../../animation/animated-components'
import { MOTE_LAYOUT } from '../../data/scatter'

/*
 * Lit-cluster aura — a warm cream-magenta radial wash centred on
 * the centroid of all currently-lit stars, with radius spanning
 * the cluster + a small padding. Reads as "this side of the figure
 * is burning warm" — the lit half is BATHED in light vs the dim
 * unlit half. Subtle breath on the system breathT keeps it alive.
 *
 * Drawn between FieldStars and BaseLayer in z-order so lit stars +
 * lines + halos all land ON TOP of the aura (the wash sits behind,
 * the bright stars in front). The radial gradient `litClusterAura`
 * is declared in SvgGradients.
 */
export function LitClusterAura({
  cx,
  cy,
  r,
  breathT,
}: {
  cx: number
  cy: number
  r: number
  breathT: SharedValue<number>
}) {
  const auraProps = useAnimatedProps(() => {
    'worklet'
    // ±4 % radius + ±0.10 opacity breath on the 16s clock so the
    // wash slowly expands + contracts like the figure is inhaling
    // light.
    const wave = 0.5 + 0.5 * Math.sin(breathT.value * 2 * Math.PI)
    return {
      r: r * (1 + wave * 0.04),
      opacity: 0.18 + wave * 0.1,
    }
  })
  return (
    <AnimatedCircle cx={cx} cy={cy} r={r} fill="url(#litClusterAura)" animatedProps={auraProps} />
  )
}

export function LitClusterMotes({
  cx,
  cy,
  r,
  t,
}: {
  cx: number
  cy: number
  r: number
  t: SharedValue<number>
}) {
  return (
    <G>
      {MOTE_LAYOUT.map((m, i) => (
        <ClusterMote key={`mt-${i}`} cx={cx + m.dx * r} cy={cy + m.dy * r} phase={m.phase} t={t} />
      ))}
    </G>
  )
}

function ClusterMote({
  cx,
  cy,
  phase,
  t,
}: {
  cx: number
  cy: number
  phase: number
  t: SharedValue<number>
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI * 1.4)
    return { opacity: 0.18 + wave * 0.55 }
  })
  return <AnimatedCircle cx={cx} cy={cy} r={0.85} fill="#FFF1F6" animatedProps={animatedProps} />
}
