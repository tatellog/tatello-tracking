import type { FC } from 'react'
import type { SvgProps } from 'react-native-svg'

import type { ZodiacSign } from './types'

import Acuario from '@/assets/zodiaco/acuario.svg'
import Aries from '@/assets/zodiaco/aries.svg'
import Cancer from '@/assets/zodiaco/cancer.svg'
import Capricornio from '@/assets/zodiaco/capricornio.svg'
import Escorpio from '@/assets/zodiaco/escorpio.svg'
import Geminis from '@/assets/zodiaco/geminis.svg'
import Leo from '@/assets/zodiaco/leo.svg'
import Libra from '@/assets/zodiaco/libra.svg'
import Piscis from '@/assets/zodiaco/piscis.svg'
import Sagitario from '@/assets/zodiaco/sagitario.svg'
import Tauro from '@/assets/zodiaco/tauro.svg'
import Virgo from '@/assets/zodiaco/virgo.svg'

/*
 * Per-sign zodiac GLYPH — the compact line symbol (currentColor-tintable),
 * distinct from the ornate pictorial ART (ART_BY_SIGN). Use for small
 * celestial emblems where the full creature would be too much: the share
 * card, chips, headers. Pass `color` to tint.
 */
export const GLYPH_BY_SIGN: Record<ZodiacSign, FC<SvgProps>> = {
  acuario: Acuario,
  aries: Aries,
  cancer: Cancer,
  capricornio: Capricornio,
  escorpio: Escorpio,
  geminis: Geminis,
  leo: Leo,
  libra: Libra,
  piscis: Piscis,
  sagitario: Sagitario,
  tauro: Tauro,
  virgo: Virgo,
}
