import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { G, Line, Path } from 'react-native-svg'

import { AnimatedCircle, AnimatedG } from '../../animation/animated-components'
import { BURST_ANGLES } from '../../data/scatter'
import { fourPointStarPath, starRadius } from '../../geometry'
import type { Resolved } from '../../types'

/* ─ Igniting star ──────────────────────────────────────────────────
 *
 * One-shot flash drawn on top of the regular StarsLayer for the star
 * currently being marked. Combines a shockwave ring, a white-hot
 * disc, a 4-ray diffraction cross, 8 burst sparks and the settled
 * star path scaled through 1 → 2.5 → 1.
 */

export function IgnitingStar({ s, igniteT }: { s: Resolved; igniteT: SharedValue<number> }) {
  const baseR = starRadius(s.mag) + 0.5

  // Three-phase scale: grow 1→2.5 (0..0.3), hold (0.3..0.5), settle
  // 2.5→1 (0.5..1). Applied via SVG transform on the wrapping G so
  // we only set a single string per frame, no path recompute.
  const starProps = useAnimatedProps(() => {
    'worklet'
    const u = igniteT.value
    let scale = 1
    if (u < 0.3) {
      scale = 1 + (1.5 * u) / 0.3
    } else if (u < 0.5) {
      scale = 2.5
    } else {
      scale = 1 + 1.5 * (1 - (u - 0.5) / 0.5)
    }
    return {
      transform: [
        { translateX: s.x },
        { translateY: s.y },
        { scale },
        { translateX: -s.x },
        { translateY: -s.y },
      ],
    }
  })

  // Emanating ring: grows faster than the star and fades out by ~0.7
  // of the animation so it doesn't compete with the settled state.
  const ringProps = useAnimatedProps(() => {
    'worklet'
    const u = Math.min(1, igniteT.value * 1.5)
    return {
      r: baseR + u * baseR * 4,
      opacity: 0.6 * (1 - u),
    }
  })

  // White-hot flash — a brief overexposed disc that peaks ~u=0.18
  // and fades by u=0.6. Reads as the camera/eye being momentarily
  // overwhelmed by the ignition. Quadratic envelope so the rise
  // and fall both feel snappy.
  const flashProps = useAnimatedProps(() => {
    'worklet'
    const u = igniteT.value
    const env = Math.max(0, 1 - Math.abs(u - 0.18) / 0.42)
    return {
      r: baseR * (1 + u * 3),
      opacity: env * env * 0.85,
    }
  })

  // Diffraction cross spike — grows from 0 to full during 0..0.35,
  // then fades by 0.8. The big anamorphic moment of the ignition.
  const spikeProps = useAnimatedProps(() => {
    'worklet'
    const u = igniteT.value
    const grow = Math.min(1, u / 0.35)
    const fade = u < 0.55 ? 1 : Math.max(0, 1 - (u - 0.55) / 0.45)
    return {
      opacity: grow * fade * 0.95,
      transform: [
        { translateX: s.x },
        { translateY: s.y },
        { scale: grow * (1 + u * 0.6) },
        { translateX: -s.x },
        { translateY: -s.y },
      ],
    }
  })

  const spikeLen = baseR * 9

  return (
    <G>
      {/* Emanating shockwave ring */}
      <AnimatedCircle
        cx={s.x}
        cy={s.y}
        r={baseR}
        fill="none"
        stroke="rgba(255,246,229,0.85)"
        strokeWidth={0.8}
        animatedProps={ringProps}
      />
      {/* White-hot flash — overexposed disc at the moment of impact. */}
      <AnimatedCircle cx={s.x} cy={s.y} r={baseR} fill="#FFFFFF" animatedProps={flashProps} />
      {/* Diffraction cross — H + V + 2 diagonal rays grow out of the
          centre as the star ignites. The dramatic Genshin "moment of
          ignition" anamorphic flare. */}
      <AnimatedG animatedProps={spikeProps}>
        <Line
          x1={s.x - spikeLen}
          y1={s.y}
          x2={s.x + spikeLen}
          y2={s.y}
          stroke="#FFF1F6"
          strokeWidth={1.1}
          strokeLinecap="round"
        />
        <Line
          x1={s.x}
          y1={s.y - spikeLen * 0.85}
          x2={s.x}
          y2={s.y + spikeLen * 0.85}
          stroke="#FFF1F6"
          strokeWidth={0.9}
          strokeLinecap="round"
          opacity={0.85}
        />
        <Line
          x1={s.x - spikeLen * 0.55}
          y1={s.y - spikeLen * 0.55}
          x2={s.x + spikeLen * 0.55}
          y2={s.y + spikeLen * 0.55}
          stroke="#FFF1F6"
          strokeWidth={0.6}
          strokeLinecap="round"
          opacity={0.55}
        />
        <Line
          x1={s.x - spikeLen * 0.55}
          y1={s.y + spikeLen * 0.55}
          x2={s.x + spikeLen * 0.55}
          y2={s.y - spikeLen * 0.55}
          stroke="#FFF1F6"
          strokeWidth={0.6}
          strokeLinecap="round"
          opacity={0.55}
        />
      </AnimatedG>
      {/* Spark particles — 8 small cream dots that fly outward from
          the centre and fade. Each is independent (own worklet) so
          their motion stays per-particle smooth. */}
      {BURST_ANGLES.map((deg) => (
        <BurstSpark
          key={`bs-${deg}`}
          cx={s.x}
          cy={s.y}
          angle={(deg * Math.PI) / 180}
          distance={baseR * 7}
          igniteT={igniteT}
        />
      ))}
      <AnimatedG animatedProps={starProps}>
        <Path d={fourPointStarPath(s.x, s.y, baseR)} fill="url(#starLit)" />
      </AnimatedG>
    </G>
  )
}

/*
 * A single spark particle for the ignition burst. Flies outward
 * from (cx, cy) along `angle` to `distance`, fading opacity 1 → 0
 * over the igniteT cycle. Cubic ease on position so the spark
 * decelerates as it travels (organic, not constant-velocity).
 */
function BurstSpark({
  cx,
  cy,
  angle,
  distance,
  igniteT,
}: {
  cx: number
  cy: number
  angle: number
  distance: number
  igniteT: SharedValue<number>
}) {
  const cosA = Math.cos(angle)
  const sinA = Math.sin(angle)
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const u = igniteT.value
    // Cubic ease-out: 1 - (1-u)^3 — fast start, slow at the end.
    const eased = 1 - (1 - u) * (1 - u) * (1 - u)
    const d = eased * distance
    return {
      cx: cx + cosA * d,
      cy: cy + sinA * d,
      opacity: (1 - u) * 0.9,
    }
  })
  return <AnimatedCircle r={1.1} fill="#FFF1F6" animatedProps={animatedProps} />
}
