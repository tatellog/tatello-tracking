import Svg, { Circle, G, Line, Path } from 'react-native-svg'

import type { ZodiacSign } from '@/features/tabs/zodiac'

/*
 * Astrological sigil per sign — transcribed from assets/zodiaco/*.svg
 * into react-native-svg primitives so they render natively inside any
 * larger SVG (the orbital core, the avatar tile, …). All glyphs share
 * the same 24×24 viewBox and stroke style as the source files. Cancer
 * has two filled dots; the rest are pure strokes, so the `color`
 * argument fills the cancer dots and stays inert elsewhere.
 */
export function zodiacGlyphPaths(sign: ZodiacSign, color: string) {
  switch (sign) {
    case 'aries':
      return (
        <>
          <Path d="M 12 19 L 12 9 Q 12 4 8 4 Q 4 4 4 8" />
          <Path d="M 12 9 Q 12 4 16 4 Q 20 4 20 8" />
        </>
      )
    case 'tauro':
      return (
        <>
          <Circle cx={12} cy={15.5} r={4.5} />
          <Path d="M 3 5 Q 3 11 12 11 Q 21 11 21 5" />
        </>
      )
    case 'geminis':
      return (
        <>
          <Line x1={8} y1={6} x2={8} y2={18} />
          <Line x1={16} y1={6} x2={16} y2={18} />
          <Path d="M 5 6 Q 8 4 11 6" />
          <Path d="M 13 6 Q 16 4 19 6" />
          <Path d="M 5 18 Q 8 20 11 18" />
          <Path d="M 13 18 Q 16 20 19 18" />
        </>
      )
    case 'cancer':
      return (
        <>
          <Path d="M 4 9 Q 4 4 10 4 L 15 4" />
          <Circle cx={15} cy={4} r={1.6} fill={color} stroke="none" />
          <Path d="M 20 15 Q 20 20 14 20 L 9 20" />
          <Circle cx={9} cy={20} r={1.6} fill={color} stroke="none" />
        </>
      )
    case 'leo':
      return (
        <>
          <Circle cx={8.5} cy={8.5} r={3.5} />
          <Path d="M 12 9 Q 17 9 17 14 Q 17 19 11.5 19.5 Q 6 20 6 15.5" />
        </>
      )
    case 'virgo':
      return (
        <>
          <Path d="M 4 18 L 4 8 Q 4 5 7 5 Q 9 5 9 8 L 9 18" />
          <Path d="M 9 18 L 9 8 Q 9 5 12 5 Q 14 5 14 8 L 14 18" />
          <Path d="M 14 18 L 14 8 Q 14 5 17 5 Q 19 5 19 8 L 19 14 Q 19 16 17 16" />
          <Path d="M 19 14 Q 21 16 19 18" />
        </>
      )
    case 'libra':
      return (
        <>
          <Path d="M 5 12 Q 5 6 12 6 Q 19 6 19 12" />
          <Line x1={4} y1={18} x2={20} y2={18} />
          <Line x1={9} y1={13} x2={15} y2={13} />
        </>
      )
    case 'escorpio':
      return (
        <>
          <Path d="M 4 18 L 4 8 Q 4 5 7 5 Q 9 5 9 8 L 9 18" />
          <Path d="M 9 18 L 9 8 Q 9 5 12 5 Q 14 5 14 8 L 14 18" />
          <Path d="M 14 18 L 14 8 Q 14 5 17 5 Q 19 5 19 8 L 19 17" />
          <Path d="M 19 17 L 22 14 M 19 17 L 22 19" />
        </>
      )
    case 'sagitario':
      return (
        <>
          <Line x1={5} y1={19} x2={19} y2={5} />
          <Path d="M 19 5 L 12 5 M 19 5 L 19 12" />
          <Line x1={8} y1={13} x2={13} y2={18} />
        </>
      )
    case 'capricornio':
      return (
        <>
          <Path d="M 4 5 L 9 19 L 13 9" />
          <Path d="M 13 9 Q 17 7 17 12 Q 17 17 14 17 Q 11 17 11 14 Q 11 11 14 11.5" />
        </>
      )
    case 'acuario':
      return (
        <>
          <Path d="M 3 9 Q 6 6 9 9 T 15 9 T 21 9" />
          <Path d="M 3 15 Q 6 12 9 15 T 15 15 T 21 15" />
        </>
      )
    case 'piscis':
      return (
        <>
          <Path d="M 4 5 Q 8 12 4 19" />
          <Path d="M 20 5 Q 16 12 20 19" />
          <Line x1={5} y1={12} x2={19} y2={12} />
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
      <G stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {zodiacGlyphPaths(sign, color)}
      </G>
    </Svg>
  )
}
