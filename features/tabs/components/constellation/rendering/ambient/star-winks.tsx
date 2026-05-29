import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { Circle, G, Path } from 'react-native-svg'

import { AnimatedG } from '../../animation/animated-components'
import { H, W } from '../../constants'
import { WINK_POSITIONS } from '../../data/scatter'
import { fourPointStarPath } from '../../geometry'

/* ─ Star winks — random brief flashes ──────────────────────────────
 *
 * Five deterministic positions scattered around the canvas (away
 * from the constellation centre and the day-count chip), each
 * winks for ~350 ms on a 5 s cycle, staggered so a wink occurs
 * every ~1 s on average. Sells "the sky is alive" without
 * tipping into noise.
 */
export function StarWinks({ t }: { t: SharedValue<number> }) {
  return (
    <G>
      {WINK_POSITIONS.map((w, i) => (
        <StarWink key={i} wink={w} t={t} />
      ))}
    </G>
  )
}

function StarWink({ wink, t }: { wink: (typeof WINK_POSITIONS)[number]; t: SharedValue<number> }) {
  const cx = wink.x * W
  const cy = wink.y * H
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const u = (t.value / wink.period + wink.phase) % 1
    // Active window: first 7 % of cycle ≈ 350 ms at period 5 s.
    if (u > 0.07) return { opacity: 0 }
    const local = u / 0.07 // 0..1 across the wink
    // Triangular envelope: rise 0..0.4 then fall 0.4..1
    const env = local < 0.4 ? local / 0.4 : 1 - (local - 0.4) / 0.6
    return { opacity: env }
  })
  return (
    <AnimatedG animatedProps={animatedProps}>
      <Path d={fourPointStarPath(cx, cy, wink.size)} fill="#FFFFFF" />
      <Circle cx={cx} cy={cy} r={wink.size * 0.35} fill="#FFFFFF" />
    </AnimatedG>
  )
}
