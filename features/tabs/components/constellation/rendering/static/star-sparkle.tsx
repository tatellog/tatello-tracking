import { Circle, Line, Path } from 'react-native-svg'

import { HERO_MAG, SPARKLE_MAG } from '../../constants'
import { fourPointStarPath } from '../../geometry'

/* The star body. A 4-point spark, plus — for bright stars — a second
 * smaller spark crossed at 45°, so a figure's brightest jewels show
 * the 8-ray glint of the reference art instead of a flat asterisk. */
export function StarSparkle({
  cx,
  cy,
  r,
  mag,
  fill,
  lit = false,
}: {
  cx: number
  cy: number
  r: number
  mag: number
  fill: string
  /** When true, render the long diffraction spikes and the white-hot
   *  pinpoint that signal "this star is alight". Placeholders and the
   *  next-affordance get only the body so the lit field stays the
   *  unambiguous bright layer. */
  lit?: boolean
}) {
  const isHero = mag <= HERO_MAG
  // Hierarchy strategy:
  //   • lit hero (alpha)    → full astrophotography treatment:
  //       horizontal+vertical diffraction spikes + 4-point body +
  //       rotated 45° cross sparkle + white-hot pinpoint.
  //   • lit secondary       → simple bright circle + cream-rosa
  //       pinpoint. NO 4-point, NO rotated cross, NO white pinpoint.
  //       Secondaries should read as "figure nodes" guiding the eye
  //       along the silhouette, not as competing hero stars.
  //   • unlit placeholder   → keep the 4-point silhouette so the
  //       resting figure still reads as a constellation-in-waiting
  //       against the ambient field.
  if (lit && !isHero) {
    // A small 4-point spark — the inherent shape of the path reads as
    // "point of light" rather than "sphere". Circles felt like pearls
    // on a string; the spark feels like a glint. No rotated cross or
    // white pinpoint here — those belong to the hero alone.
    return <Path d={fourPointStarPath(cx, cy, r * 0.7)} fill={fill} />
  }
  const spikeLen = r * 7
  return (
    <>
      {/* Diffraction spikes — lit ALPHAS only. Horizontal + vertical
          rays, no diagonals. Drawn before the body so the bright
          core sits on top and crisps the centre. */}
      {lit && isHero ? (
        <>
          <Line
            x1={cx - spikeLen}
            y1={cy}
            x2={cx + spikeLen}
            y2={cy}
            stroke="#FBD7E3"
            strokeOpacity={0.55}
            strokeWidth={0.9}
            strokeLinecap="round"
          />
          <Line
            x1={cx}
            y1={cy - spikeLen}
            x2={cx}
            y2={cy + spikeLen}
            stroke="#FBD7E3"
            strokeOpacity={0.55}
            strokeWidth={0.9}
            strokeLinecap="round"
          />
        </>
      ) : null}
      <Path d={fourPointStarPath(cx, cy, r)} fill={fill} />
      {mag <= SPARKLE_MAG ? (
        <Path
          d={fourPointStarPath(cx, cy, r * 0.6)}
          fill={fill}
          transform={[
            { translateX: cx },
            { translateY: cy },
            { rotate: '45deg' },
            { translateX: -cx },
            { translateY: -cy },
          ]}
        />
      ) : null}
      {/* White-hot pinpoint — lit heroes only. */}
      {lit && isHero ? <Circle cx={cx} cy={cy} r={r * 0.35} fill="#FFFFFF" opacity={0.85} /> : null}
    </>
  )
}
