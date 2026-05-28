import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { Circle } from 'react-native-svg'

import { colors } from '@/theme'

import { AnimatedG } from '../../animation/animated-components'
import { H, PAD, W } from '../../constants'

/* ─ Field stars ───────────────────────────────────────────────────
 *
 * The unconnected padding stars (see deriveProgress). They light up
 * interleaved with the figure so the canvas keeps filling across the
 * whole 28-day cycle. A lit field star is a small magenta 4-point
 * star — magenta is the "earned progress" colour, so it reads as
 * yours against the dim cream ambient field without needing a glow
 * disc (a filled halo circle reads as a hard-edged coin in isolation).
 * Unlit ones don't render: the ambient field covers "empty sky". */
export function FieldStars({
  fieldStars,
  litKeys,
  t,
}: {
  fieldStars: readonly { x: number; y: number }[]
  litKeys: Set<string>
  t: SharedValue<number>
}) {
  return (
    <>
      {fieldStars.map((fs, n) =>
        litKeys.has(`field-${n}`) ? <FieldStar key={n} fs={fs} n={n} t={t} /> : null,
      )}
    </>
  )
}

/* A lit padding star — tiny magenta dot with a soft halo. Was a big
 * 4-point sparkle, but at that size and brightness the padding field
 * competed with the actual figure stars and made the canvas feel
 * crowded. Now reads as a quiet "your progress also filled this
 * patch of sky" mark — present, magenta, but unambiguously secondary
 * to the architectural figure. */
function FieldStar({
  fs,
  n,
  t,
}: {
  fs: { x: number; y: number }
  n: number
  t: SharedValue<number>
}) {
  const cx = PAD + fs.x * (W - 2 * PAD)
  const cy = PAD + fs.y * (H - 2 * PAD)
  const phase = (n * 0.21) % 1
  const starProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    return { opacity: 0.4 + 0.2 * wave }
  })
  return (
    <AnimatedG animatedProps={starProps}>
      <Circle cx={cx} cy={cy} r={4} fill={colors.magenta} opacity={0.18} />
      <Circle cx={cx} cy={cy} r={1.6} fill={colors.magenta} />
      <Circle cx={cx} cy={cy} r={0.7} fill="#FBD7E3" opacity={0.9} />
    </AnimatedG>
  )
}
