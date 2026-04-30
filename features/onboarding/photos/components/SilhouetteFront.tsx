import Svg, { Circle, Path } from 'react-native-svg'

type Props = {
  width?: number
  height?: number
  stroke?: string
  strokeWidth?: number
}

/*
 * Front silhouette — head, shoulders, torso, arms, legs. Drawn as a
 * single outlined contour so a person aligning to it can see exactly
 * where their head, shoulders, hips and feet are expected. The
 * proportions are stylised, not photoreal — enough cue to align by.
 *
 * viewBox 0 0 120 240 keeps width:height roughly 1:2, matching a
 * standing-figure framing inside the camera preview.
 */
export function SilhouetteFront({
  width = 110,
  height = 220,
  stroke = 'rgba(255,255,255,0.6)',
  strokeWidth = 1.5,
}: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 120 240" fill="none">
      {/* Head */}
      <Circle cx={60} cy={26} r={16} stroke={stroke} strokeWidth={strokeWidth} fill="none" />
      {/* Body outline: neck → shoulders → arms (down at sides) → torso → hips → legs → feet */}
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
    </Svg>
  )
}
