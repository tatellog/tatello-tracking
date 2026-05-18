import Svg, { Circle, G, Path } from 'react-native-svg'

import type { ZodiacSign } from './types'

/*
 * A simple line-glyph of each zodiac sign's creature or figure — used
 * as the profile avatar when the user hasn't set a photo. Iconographic,
 * not detailed: a recognizable silhouette in the app's stroked-glyph
 * style (same vocabulary as the meal / slot glyphs).
 */
function figure(sign: ZodiacSign, color: string) {
  const dot = (cx: number, cy: number) => (
    <Circle cx={cx} cy={cy} r={0.95} fill={color} stroke="none" />
  )
  switch (sign) {
    // Aries — the ram: a small face under two curled horns.
    case 'aries':
      return (
        <>
          <Circle cx={12} cy={15} r={3} />
          <Path d="M9.6 12.6 C 6 12.3 6 7 9.8 7 C 11.9 7 11.3 9.8 9.8 10" />
          <Path d="M14.4 12.6 C 18 12.3 18 7 14.2 7 C 12.1 7 12.7 9.8 14.2 10" />
        </>
      )
    // Taurus — the bull: a round face crowned by two rising horns.
    case 'tauro':
      return (
        <>
          <Circle cx={12} cy={14} r={5} />
          <Path d="M8 10.4 C 5 9 4 5.4 6.6 3.4" />
          <Path d="M16 10.4 C 19 9 20 5.4 17.4 3.4" />
          {dot(10, 13)}
          {dot(14, 13)}
        </>
      )
    // Gemini — the twins: two figures joined at the arms.
    case 'geminis':
      return (
        <>
          <Circle cx={8.4} cy={6.4} r={2.3} />
          <Circle cx={15.6} cy={6.4} r={2.3} />
          <Path d="M8.4 8.7 V19" />
          <Path d="M15.6 8.7 V19" />
          <Path d="M8.4 12 H15.6" />
        </>
      )
    // Cancer — the crab: a round body, two front claws, side legs.
    case 'cancer':
      return (
        <>
          <Circle cx={12} cy={14} r={3.8} />
          <Path d="M8.7 11 C 6.2 9.4 4.4 10.8 5.6 13" />
          <Path d="M15.3 11 C 17.8 9.4 19.6 10.8 18.4 13" />
          <Path d="M8.8 15.6 L6.2 17.8 M9.6 16.9 L7.4 19.4" />
          <Path d="M15.2 15.6 L17.8 17.8 M14.4 16.9 L16.6 19.4" />
        </>
      )
    // Leo — the lion: a face ringed by a lumpy mane.
    case 'leo':
      return (
        <>
          <Path d="M12 4.6 C 14.2 4.6 14.8 6.8 16.6 7.4 C 18.6 8 19.4 10.4 18.8 12.6 C 19.2 14.8 18.4 16.6 16.6 17.6 C 15 19.4 13 19.4 12 19.4 C 11 19.4 9 19.4 7.4 17.6 C 5.6 16.6 4.8 14.8 5.2 12.6 C 4.6 10.4 5.4 8 7.4 7.4 C 9.2 6.8 9.8 4.6 12 4.6 Z" />
          {dot(10.2, 11.8)}
          {dot(13.8, 11.8)}
          <Path d="M10 14.6 C 11 15.6 13 15.6 14 14.6" />
        </>
      )
    // Virgo — the maiden: a head over a flowing gown.
    case 'virgo':
      return (
        <>
          <Circle cx={12} cy={5.8} r={2.3} />
          <Path d="M12 8.1 L7.4 19.4 H16.6 Z" />
          <Path d="M9.2 12.4 H14.8" />
        </>
      )
    // Libra — the scales: a beam with two hanging pans on a stand.
    case 'libra':
      return (
        <>
          <Path d="M12 6 V18.6 M8.4 18.6 H15.6" />
          <Path d="M4.6 9 H19.4" />
          <Path d="M4.6 9 V10.4 M2.2 10.4 C 2.7 13.6 6.5 13.6 7 10.4 Z" />
          <Path d="M19.4 9 V10.4 M17 10.4 C 17.5 13.6 21.3 13.6 21.8 10.4 Z" />
        </>
      )
    // Scorpio — the scorpion: a body, front claws, a curling stinger.
    case 'escorpio':
      return (
        <>
          <Path d="M5.4 16 C 5.4 12.6 11.6 12.6 11.6 16" />
          <Path d="M5.6 14.4 C 3.8 13 2.8 14.4 3.8 16" />
          <Path d="M8.6 13.2 C 7 11.4 5.4 12.6 6.2 14.4" />
          <Path d="M11.6 15.4 C 15.4 15.4 17.8 13.4 17.4 9.6 C 17.2 7.7 15 7.9 15.6 10.2" />
        </>
      )
    // Sagittarius — the archer: an arrow drawn across a bow.
    case 'sagitario':
      return (
        <>
          <Path d="M5 19 L17.4 6.6" />
          <Path d="M12.6 6.6 H17.4 V11.4" />
          <Path d="M5 19 H9 M5 19 V15" />
          <Path d="M8.4 4.8 C 16.4 6.4 18.6 14.4 12 19.4" />
        </>
      )
    // Capricorn — the sea-goat: a face, swept-back horns, a beard.
    case 'capricornio':
      return (
        <>
          <Circle cx={11} cy={13} r={3.4} />
          <Path d="M9 9.8 C 7 6.8 8.6 4 11.8 4" />
          <Path d="M13 10 C 15.6 8 16.8 5.4 15.2 3.8" />
          <Path d="M10.2 16.2 L9.8 19 M11.6 16.4 L11.9 19.2" />
          <Path d="M16 16 C 19.4 15.6 20.6 12 18 10.4" />
        </>
      )
    // Aquarius — the water bearer: two flowing waves.
    case 'acuario':
      return (
        <>
          <Path d="M4 10 Q 6 7.4 8 10 T 12 10 T 16 10 T 20 10" />
          <Path d="M4 15 Q 6 12.4 8 15 T 12 15 T 16 15 T 20 15" />
        </>
      )
    // Pisces — the two fish, swimming opposite ways.
    case 'piscis':
      return (
        <>
          <Path d="M4.4 8 Q 9 5 12.6 8 Q 9 11 4.4 8 Z" />
          <Path d="M4.4 8 L2 6 M4.4 8 L2 10" />
          {dot(10.6, 8)}
          <Path d="M19.6 16 Q 15 19 11.4 16 Q 15 13 19.6 16 Z" />
          <Path d="M19.6 16 L22 18 M19.6 16 L22 14" />
          {dot(13.4, 16)}
        </>
      )
    default:
      return null
  }
}

/* The zodiac sign's figure, drawn as a stroked line-glyph. */
export function ZodiacFigure({
  sign,
  size,
  color,
}: {
  sign: ZodiacSign
  size: number
  color: string
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {figure(sign, color)}
      </G>
    </Svg>
  )
}
