import Svg, { Circle, Line, Path } from 'react-native-svg'

type Props = {
  width?: number
  height?: number
  stroke?: string
  strokeWidth?: number
}

/*
 * Back silhouette — same outer contour as front (the body shape from
 * behind looks the same in this stylised representation) plus a
 * dashed vertical line marking the spine. The dashed line is the
 * primary alignment cue: it's much harder to centre your body
 * looking at your back through a phone screen than from the front.
 */
export function SilhouetteBack({
  width = 110,
  height = 220,
  stroke = 'rgba(255,255,255,0.6)',
  strokeWidth = 1.5,
}: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 120 240" fill="none">
      <Circle cx={60} cy={26} r={16} stroke={stroke} strokeWidth={strokeWidth} fill="none" />
      <Path
        d={`
          M 53 42
          L 53 50
          L 32 60
          L 28 84
          L 24 130
          L 30 134
          L 40 96
          L 44 60
          L 50 56
          L 50 110
          L 46 180
          L 48 230
          L 56 230
          L 58 180
          L 60 130
          L 62 180
          L 64 230
          L 72 230
          L 74 180
          L 70 110
          L 70 56
          L 76 60
          L 80 96
          L 90 134
          L 96 130
          L 92 84
          L 88 60
          L 67 50
          L 67 42
          Z
        `}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      {/* Spine alignment line */}
      <Line
        x1={60}
        y1={50}
        x2={60}
        y2={210}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray="4 6"
      />
    </Svg>
  )
}
