import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { G } from 'react-native-svg'

import { colors } from '@/theme'

import { AnimatedCircle } from '../../animation/animated-components'
import { starRadius } from '../../geometry'
import type { Resolved } from '../../types'
import { StarSparkle } from '../static'

/* "Next" reads as a queued summoning slot — quiet enough that the
 * lit stars stay the focal layer, but visibly turning so the user
 * sees a clock running. The actual sigilo layout (outer ring +
 * ticks rotating CCW, inner dashed ring rotating CW, plus a wish-
 * countdown pulse ring) is described inline below. */
export function NextStar({
  s,
  t,
  reduce,
}: {
  s: Resolved
  t: SharedValue<number>
  reduce: boolean
}) {
  const baseR = starRadius(s.mag) + 0.5

  // Soft breath halo telegraphing "this is the next ignition" —
  // replaces the previous rotating-rings + ticks sigil which read
  // as a targeting reticle (HUD, not celestial). The signal is
  // now: a single warm magenta halo whose alpha + radius gently
  // swell once every ~3 s, plus the central StarSparkle tinted
  // magenta so the eye still finds the slot.
  //
  // REDUCED MOTION: the halo MUST stay legible as "próxima / te
  // espera", so it rests at the SWELL'S HIGH END (u = 1 → r = baseR
  // + 10, opacity 0.40) instead of disappearing — it simply stops
  // breathing. `reduce` is a constant prop captured as a worklet
  // closure scalar (the reveal reads its `instant` flag the same way).
  const breathProps = useAnimatedProps(() => {
    'worklet'
    const u = reduce ? 1 : 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI * (8 / 3))
    return {
      r: baseR + 4 + u * 6,
      opacity: 0.18 + 0.22 * u,
    }
  })

  return (
    <G>
      <AnimatedCircle
        cx={s.x}
        cy={s.y}
        r={baseR + 4}
        fill={colors.magenta}
        animatedProps={breathProps}
      />
      <StarSparkle cx={s.x} cy={s.y} r={baseR} mag={s.mag} fill="url(#starNext)" />
    </G>
  )
}
