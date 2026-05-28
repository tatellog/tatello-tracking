import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { G } from 'react-native-svg'

import { AnimatedCircle } from '../../animation/animated-components'
import { H, W } from '../../constants'
import { DUST } from '../../data/scatter'
import type { DustParticle } from '../../types'

/* ─ Cosmic dust — slow rising motes ───────────────────────────────
 *
 * A small constellation-adjacent magic: 7 tiny cream particles that
 * slowly rise from the bottom of the canvas to the top, swaying
 * gently as they drift. Each has its own period + phase so the
 * field never reads as a synchronised loop — it reads as ambient
 * weather, like floating pollen catching starlight.
 *
 * Visible duty: fades in at 0..0.12 of cycle, full alpha through
 * the middle, fades out at 0.88..1. Each particle spends most of
 * the cycle off-canvas (well below or above), so at any moment
 * only ~3-4 are actually visible.
 */
export function CosmicDust({ t }: { t: SharedValue<number> }) {
  return (
    <G>
      {DUST.map((p, i) => (
        <DustMote key={i} particle={p} t={t} />
      ))}
    </G>
  )
}

function DustMote({ particle, t }: { particle: DustParticle; t: SharedValue<number> }) {
  const baseX = particle.x * W
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const u = (t.value / particle.period + particle.phase) % 1
    // Travel from H + 20 (below) to -20 (above) as u goes 0→1.
    const y = H + 20 - u * (H + 40)
    // Horizontal sway — full sine over the rise.
    const x = baseX + Math.sin(u * Math.PI * 2) * particle.sway
    // Fade in 0..0.12, hold, fade out 0.88..1.
    let op = particle.opacity
    if (u < 0.12) op *= u / 0.12
    else if (u > 0.88) op *= 1 - (u - 0.88) / 0.12
    return { cx: x, cy: y, opacity: op }
  })
  return (
    <AnimatedCircle
      cx={baseX}
      cy={H + 20}
      r={particle.r}
      fill="#FFF6E5"
      animatedProps={animatedProps}
    />
  )
}
