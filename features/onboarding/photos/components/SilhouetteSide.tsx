import Svg, { Circle, Path } from 'react-native-svg'

type Props = {
  width?: number
  height?: number
  stroke?: string
  strokeWidth?: number
}

/*
 * Side / profile silhouette — head, neck, chest, arm hanging down,
 * back curve, glute, leg. One contour. Used by both side_right (as
 * drawn) and side_left (parent renders with scaleX(-1)).
 *
 * viewBox 0 0 100 240 — narrower than the front so the profile fits
 * snugly without dead horizontal space.
 */
export function SilhouetteSide({
  width = 90,
  height = 220,
  stroke = 'rgba(255,255,255,0.6)',
  strokeWidth = 1.5,
}: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 240" fill="none">
      <Circle cx={56} cy={26} r={14} stroke={stroke} strokeWidth={strokeWidth} fill="none" />
      <Path
        d={`
          M 50 40
          L 48 50
          L 38 58
          L 32 80
          L 30 110
          L 36 130
          L 30 134
          L 36 100
          L 38 78
          L 44 64
          L 44 110
          L 38 150
          L 36 200
          L 38 230
          L 50 230
          L 52 200
          L 56 150
          L 64 110
          L 66 80
          L 60 58
          L 58 50
          L 56 40
          Z
        `}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  )
}
