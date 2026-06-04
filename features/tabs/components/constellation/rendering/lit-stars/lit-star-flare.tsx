import { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { Ellipse, Line } from 'react-native-svg'

import { AnimatedG } from '../../animation/animated-components'

/*
 * Anamorphic lens flare for the brightest lit stars — a long
 * horizontal cream streak (camera anamorphic look) crossed by a
 * 4-ray diffraction starburst (H/V/two diagonals). Shimmers with a
 * subtle continuous scale wobble on `t` so the rays never freeze.
 *
 * Length + opacity both scale with `intensity` (per-magnitude
 * weight from LitStar) and `haloMult` (recency fade), so an older
 * lit star's flare dims along with its halo.
 */
export function LitStarFlare({
  cx,
  cy,
  r,
  intensity,
  haloMult,
  t,
  phase,
}: {
  cx: number
  cy: number
  r: number
  intensity: number
  haloMult: number
  t: SharedValue<number>
  phase: number
}) {
  // Lens-flare geometry — further trimmed to almost-invisible on
  // the alpha. With the ornate ring of the new zodiac-art assets
  // taking the decorative role, the cross's job is just a hint of
  // "this is a bright star", not a feature.
  const rayH = r * (1.0 + intensity * 1.4) // ~1.0r dim → ~2.4r bright
  const rayV = rayH * 0.6
  const rayDiag = rayH * 0.28
  const flareThickness = Math.max(0.35, r * 0.11)
  const op = intensity * 0.22 * haloMult

  // Shimmer: scale-about-(cx, cy) wobble + opacity twinkle so the
  // flare visibly breathes like a real lens catching ambient motion.
  const shimmer = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI * 1.3)
    const scale = 0.92 + wave * 0.16
    return {
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
    <AnimatedG animatedProps={shimmer} opacity={op}>
      {/* Horizontal anamorphic streak — the lens flare signature. */}
      <Ellipse cx={cx} cy={cy} rx={rayH} ry={flareThickness} fill="#FFF6E5" opacity={0.28} />
      {/* Asymmetric cross — H thick + bright, V medium, diagonals thin. */}
      <Line
        x1={cx - rayH}
        y1={cy}
        x2={cx + rayH}
        y2={cy}
        stroke="#FFF6E5"
        strokeWidth={0.9}
        strokeLinecap="round"
        opacity={0.85}
      />
      <Line
        x1={cx}
        y1={cy - rayV}
        x2={cx}
        y2={cy + rayV}
        stroke="#FFF6E5"
        strokeWidth={0.6}
        strokeLinecap="round"
        opacity={0.6}
      />
      <Line
        x1={cx - rayDiag}
        y1={cy - rayDiag}
        x2={cx + rayDiag}
        y2={cy + rayDiag}
        stroke="#FFF6E5"
        strokeWidth={0.4}
        strokeLinecap="round"
        opacity={0.35}
      />
      <Line
        x1={cx - rayDiag}
        y1={cy + rayDiag}
        x2={cx + rayDiag}
        y2={cy - rayDiag}
        stroke="#FFF6E5"
        strokeWidth={0.4}
        strokeLinecap="round"
        opacity={0.35}
      />
    </AnimatedG>
  )
}
