import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { Circle, Line } from 'react-native-svg'

import type { ZodiacDef } from '../../../../zodiac/types'
import { AnimatedG } from '../../animation/animated-components'
import { HERO_MAG } from '../../constants'
import { starRadius } from '../../geometry'
import type { Resolved } from '../../types'
import { StarSparkle } from '../static'

/* ─ Base placeholder layer (always visible silhouette) ──────────── */

export function BaseLayer({
  zodiac,
  stars,
  slowT,
  radialPulse,
  t,
}: {
  zodiac: ZodiacDef
  stars: Resolved[]
  /** 5 s clock — modulates a sin wave between 0.78× and 1.22× of the
   *  base opacity so the placeholder silhouette gently breathes. Most
   *  visible at count = 0 where nothing else is lit; once stars sit on
   *  top, the breath happens "behind" them and reads as ambient. */
  slowT: SharedValue<number>
  /** 0..1 one-shot wave fired on commit. While > 0 the placeholder
   *  silhouette gets a brightness boost so the WHOLE figure flashes
   *  alongside the magenta radial ring — "the constellation fills up". */
  radialPulse: SharedValue<number>
  /** 8 s clock shared with the lit-star layer so the placeholder
   *  stars breathe + twinkle on the same heartbeat (just dimmer). */
  t: SharedValue<number>
}) {
  // Silhouette opacity wave — a slow breath on the unlit lines so
  // the placeholder figure feels alive, plus a parabolic flash on
  // every commit so the full shape pulses with the ignition.
  const linesProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(slowT.value * 2 * Math.PI)
    const flash = radialPulse.value * (1 - radialPulse.value) * 2
    const op = 0.55 + 0.25 * wave + flash * 0.4
    return { opacity: op > 1 ? 1 : op }
  })
  return (
    <>
      {/* Unlit line silhouettes — solid (no dashes) cream strokes
          so the figure outline reads as a continuous ghost shape
          rather than a dotted preview. Faint enough to recede when
          the lit segments fire on top, present enough for the user
          to feel "the figure is here, waiting to be lit". */}
      <AnimatedG animatedProps={linesProps}>
        {zodiac.lines.map(([a, b], idx) => {
          const A = stars[a]
          const B = stars[b]
          if (!A || !B) return null
          return (
            <Line
              key={`bl-${idx}`}
              x1={A.x}
              y1={A.y}
              x2={B.x}
              y2={B.y}
              stroke="#F4ECDE"
              strokeOpacity={0.28}
              strokeWidth={2.6}
              strokeLinecap="round"
            />
          )
        })}
      </AnimatedG>
      {stars.map((s, i) => (
        <PlaceholderStar key={`bs-${i}`} s={s} i={i} t={t} />
      ))}
    </>
  )
}

/* Animated placeholder star — same breathing + twinkle pattern as
 * `LitStar` but tuned softer (smaller scale swing, slightly dimmer
 * cream fill) so the unlit field reads as "waiting" rather than "lit".
 * Each star has its own phase offset so the field is asynchronous —
 * adjacent stars never breathe or twinkle in sync. */
/* Soft magenta bloom for hero stars — two stacked low-alpha discs.
 * The hero is each figure's alpha star; the magenta glow makes it
 * "the fuchsia one" — unmistakably the brightest — in both the
 * placeholder and lit states. Drawn behind the star body. */
/* Multi-layer halo stack for alpha stars — matches the visual weight
 * of the orbital hero suns in Día/Semana. Five concentric layers fake
 * a smooth radial falloff without using <RadialGradient> (which has
 * the same iOS alpha-stop bug noted in AmbientGlow). Inner cream-pink
 * ring suggests heat at the core; outer magenta layers bloom into the
 * sky.
 *
 * The wrap AnimatedG breathes the entire halo on a 4 s cycle (per-star
 * phase offset so the three anchors of a figure never pulse in
 * unison). Both the overall opacity AND the scale ride the wave, so
 * the bloom visibly inflates and softens — anchors read as alive,
 * not just bigger circles. */
export function HeroGlow({
  cx,
  cy,
  r,
  t,
  phase,
}: {
  cx: number
  cy: number
  r: number
  t: SharedValue<number>
  phase: number
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value * 2 + phase) * 2 * Math.PI)
    const scale = 1 + wave * 0.12
    const op = 0.45 + wave * 0.3
    return {
      opacity: op > 1 ? 1 : op,
      transform: [
        { translateX: cx },
        { translateY: cy },
        { scale },
        { translateX: -cx },
        { translateY: -cy },
      ],
    }
  })
  return (
    <AnimatedG animatedProps={animatedProps}>
      {/* Recoloured magenta → cream-gold and shrunk (6.4×r → 3.6×r
          outermost, opacities halved). Magenta is now exclusively
          the next-star action signal; the hero anchor remains the
          brightest body of the figure but stops dominating the
          composition. */}
      <Circle cx={cx} cy={cy} r={r * 3.6} fill="#D9AE6F" opacity={0.04} />
      <Circle cx={cx} cy={cy} r={r * 2.6} fill="#D9AE6F" opacity={0.07} />
      <Circle cx={cx} cy={cy} r={r * 1.8} fill="#F4ECDE" opacity={0.12} />
      <Circle cx={cx} cy={cy} r={r * 1.2} fill="#FFF6E5" opacity={0.22} />
    </AnimatedG>
  )
}

function PlaceholderStar({ s, i, t }: { s: Resolved; i: number; t: SharedValue<number> }) {
  const baseR = starRadius(s.mag) * 0.95
  const isHero = s.mag <= HERO_MAG
  const phase = (i * 0.137) % 1

  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    // Softer breath than lit stars (7 % vs 10 %) — still visible
    // motion, but the lit layer should always read as the brighter
    // half of the hierarchy when both coexist.
    const scale = 1 + wave * 0.07

    // Same scintillation period as lit stars but with a deeper dim
    // (down to 0.42 of base) so the eye registers the twinkle on the
    // dimmer cream fill.
    const twinkleCycle = (t.value * 2.4 + i * 0.31) % 1
    let twinkleOp = 1
    if (twinkleCycle < 0.04) {
      twinkleOp = 1 - (twinkleCycle / 0.04) * 0.58
    } else if (twinkleCycle < 0.08) {
      twinkleOp = 0.42 + ((twinkleCycle - 0.04) / 0.04) * 0.58
    }

    // ~35 % floor with breath — strong enough that the user sees
    // the FULL figure outline (so the constellation reads as a
    // path-in-progress, not a half-erased shape) while still
    // leaving clear contrast against the lit half.
    const ambient = (0.32 + 0.1 * wave) * twinkleOp
    return {
      opacity: ambient,
      transform: [
        { translateX: s.x },
        { translateY: s.y },
        { scale },
        { translateX: -s.x },
        { translateY: -s.y },
      ],
    }
  })

  return (
    <AnimatedG animatedProps={animatedProps}>
      {isHero ? <HeroGlow cx={s.x} cy={s.y} r={baseR} t={t} phase={phase} /> : null}
      <StarSparkle cx={s.x} cy={s.y} r={baseR} mag={s.mag} fill="#F4ECDE" />
    </AnimatedG>
  )
}
