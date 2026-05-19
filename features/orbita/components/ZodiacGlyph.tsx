import Svg, { Circle, G, Path } from 'react-native-svg'

import type { ZodiacSign } from '@/features/tabs/zodiac'

/*
 * Hand-drawn astrological symbols — a clean stroked line glyph per
 * sign, in the app's 24×24 icon idiom. Replaces the Unicode zodiac
 * characters, which render as tofu boxes in the custom UI font.
 */
export function zodiacGlyphPaths(sign: ZodiacSign) {
  switch (sign) {
    case 'aries':
      return (
        <>
          <Path d="M12 21 V12" />
          <Path d="M12 12 C 12 6 6 6 6 11.6" />
          <Path d="M12 12 C 12 6 18 6 18 11.6" />
        </>
      )
    case 'tauro':
      return (
        <>
          <Circle cx={12} cy={15} r={5.2} />
          <Path d="M6.5 9.6 C 7.3 3.6 16.7 3.6 17.5 9.6" />
        </>
      )
    case 'geminis':
      return (
        <>
          <Path d="M8 5 V19" />
          <Path d="M16 5 V19" />
          <Path d="M6 5.7 Q12 8.3 18 5.7" />
          <Path d="M6 18.3 Q12 15.7 18 18.3" />
        </>
      )
    case 'cancer':
      return (
        <>
          <Circle cx={7} cy={9.6} r={1.9} />
          <Path d="M8.7 8.7 C 12 6 16.4 8 17 11" />
          <Circle cx={17} cy={14.4} r={1.9} />
          <Path d="M15.3 15.3 C 12 18 7.6 16 7 13" />
        </>
      )
    case 'leo':
      return (
        <>
          <Circle cx={8.2} cy={15.6} r={3.4} />
          <Path d="M10.7 13.4 C 13.5 6 19.5 8.6 18 13 C 17.2 15.5 14.4 15.2 15.4 12.7" />
        </>
      )
    case 'virgo':
      return (
        <>
          <Path d="M5 18 V8.6" />
          <Path d="M5 8.6 Q7 5.7 9 8.6 V18" />
          <Path d="M9 8.6 Q11 5.7 13 8.6 V14.6" />
          <Path d="M13 12.4 C 13 17.8 18.6 16.8 17.7 11.5 C 17.1 8.6 13.8 9.3 13.4 12.4" />
        </>
      )
    case 'libra':
      return (
        <>
          <Path d="M4.5 18 H19.5" />
          <Path d="M4.5 13 H8.3 A3.7 3.7 0 0 1 15.7 13 H19.5" />
        </>
      )
    case 'escorpio':
      return (
        <>
          <Path d="M5 18 V8.6" />
          <Path d="M5 8.6 Q7 5.7 9 8.6 V18" />
          <Path d="M9 8.6 Q11 5.7 13 8.6 V18" />
          <Path d="M13 8.6 Q15 5.7 17 8.6 V15.4" />
          <Path d="M17 15.4 L20.6 19 M20.6 19 H16.9 M20.6 19 V15.4" />
        </>
      )
    case 'sagitario':
      return (
        <>
          <Path d="M5 19 L16.6 7.4" />
          <Path d="M11 7.4 H16.6 V13" />
          <Path d="M8.4 11 L12.6 15.2" />
        </>
      )
    case 'capricornio':
      return (
        <>
          <Path d="M5 9 L8.7 16.8 L11 9.5 C 12 6.4 16.6 6.4 16.6 11 C 16.6 14.9 12.3 14.6 12 11.6" />
        </>
      )
    case 'acuario':
      return (
        <>
          <Path d="M4 10 Q6 7.7 8 10 T12 10 T16 10 T20 10" />
          <Path d="M4 15 Q6 12.7 8 15 T12 15 T16 15 T20 15" />
        </>
      )
    case 'piscis':
      return (
        <>
          <Path d="M7.8 4.6 Q3.8 12 7.8 19.4" />
          <Path d="M16.2 4.6 Q20.2 12 16.2 19.4" />
          <Path d="M5.2 12 H18.8" />
        </>
      )
  }
}

/* The zodiac sign's astrological symbol, drawn as a stroked glyph. */
export function ZodiacGlyph({
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
      <G stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {zodiacGlyphPaths(sign)}
      </G>
    </Svg>
  )
}
