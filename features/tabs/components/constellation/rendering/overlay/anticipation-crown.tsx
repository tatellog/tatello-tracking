import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { G } from 'react-native-svg'

import { AnimatedCircle } from '../../animation/animated-components'

/* ─ Anticipation crown ─────────────────────────────────────────────
 *
 * A faint cream ring around the canvas centre that emerges from day
 * 21 and grows/brightens as the user approaches completion. Builds
 * the "casi llegás" tension visible in the last week without
 * stealing focus from the lit constellation.
 */

export function AnticipationCrown({
  cx,
  cy,
  proximity,
  breathT,
}: {
  cx: number
  cy: number
  /** 0..1 — 0 = day 21, 1 = day 28. Drives radius + opacity. */
  proximity: number
  breathT: SharedValue<number>
}) {
  // Smaller radius (75 → 95 px) keeps the crown inside the bright
  // focal area rather than at the canvas edge where the vignette
  // and the lion's ornate ring would absorb it. Opacities ~2× the
  // previous so the buildup actually reads in the last week.
  const baseR = 75 + proximity * 20
  const innerProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(breathT.value * 2 * Math.PI)
    return {
      opacity: (0.18 + 0.18 * wave) * (0.4 + proximity * 0.6),
      r: baseR + wave * 4,
    }
  })
  const outerProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(breathT.value * 2 * Math.PI + Math.PI * 0.4)
    return {
      opacity: (0.12 + 0.12 * wave) * (0.4 + proximity * 0.6),
      r: baseR + 10 + wave * 3,
    }
  })
  return (
    <G>
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={baseR}
        fill="none"
        stroke="#FFF6E5"
        strokeWidth={1.2}
        strokeDasharray="2 6"
        animatedProps={innerProps}
      />
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={baseR + 10}
        fill="none"
        stroke="#D9AE6F"
        strokeWidth={0.8}
        strokeDasharray="1 7"
        animatedProps={outerProps}
      />
    </G>
  )
}
