import type { ZodiacEngravingProps } from '../../ZodiacEngraving'
import type { ZodiacSign } from '../../../zodiac/types'

import AcuarioArt from '@/assets/zodiac-art/acuario-art.svg'
import AriesArt from '@/assets/zodiac-art/aries-art.svg'
import CancerArt from '@/assets/zodiac-art/cancer-art.svg'
import CapricornioArt from '@/assets/zodiac-art/capricornio-art.svg'
import EscorpioArt from '@/assets/zodiac-art/escorpio-art.svg'
import GeminisArt from '@/assets/zodiac-art/geminis-art.svg'
import LeoArt from '@/assets/zodiac-art/leo-art.svg'
import LibraArt from '@/assets/zodiac-art/libra-art.svg'
import PiscisArt from '@/assets/zodiac-art/piscis-art.svg'
import SagitarioArt from '@/assets/zodiac-art/sagitario-art.svg'
import TauroArt from '@/assets/zodiac-art/tauro-art.svg'
import VirgoArt from '@/assets/zodiac-art/virgo-art.svg'

// Per-sign art asset map — keyed by ZodiacSign so each of the 12
// signs gets its own illustrative backdrop. New signs added here
// auto-appear in SIGN_ENGRAVINGS below without touching the
// rendering logic.
export const ART_BY_SIGN: Record<ZodiacSign, ZodiacEngravingProps['art']> = {
  acuario: AcuarioArt,
  aries: AriesArt,
  cancer: CancerArt,
  capricornio: CapricornioArt,
  escorpio: EscorpioArt,
  geminis: GeminisArt,
  leo: LeoArt,
  libra: LibraArt,
  piscis: PiscisArt,
  sagitario: SagitarioArt,
  tauro: TauroArt,
  virgo: VirgoArt,
}

// Per-sign engraving backdrop — every sign now has its art via the
// ART_BY_SIGN map. `artScale` defaults to 1.0 across the board so
// the ornate ring fits the canvas exactly; override per-sign here
// if a given asset needs a different framing.
export const SIGN_ENGRAVINGS: Record<
  ZodiacSign,
  Pick<ZodiacEngravingProps, 'art' | 'artScale'>
> = Object.fromEntries(
  (Object.keys(ART_BY_SIGN) as ZodiacSign[]).map((sign) => [
    sign,
    { art: ART_BY_SIGN[sign], artScale: 1.0 },
  ]),
) as Record<ZodiacSign, Pick<ZodiacEngravingProps, 'art' | 'artScale'>>

// Per-sign constellation transform — each figure has its own
// natural bbox (Leo biases lower-left, Escorpio is centered, etc.)
// so the SVG transform that fits the asterism inside the ornate
// ring varies. Default is the Leo-tuned transform; signs that
// don't match that bias get their own override here.
export const SIGN_CONSTELLATION_TRANSFORM: Record<ZodiacSign, string> = {
  acuario: 'translate(47 41) scale(0.68)',
  aries: 'translate(46 37) scale(0.68)',
  cancer: 'translate(45 40) scale(0.68)',
  capricornio: 'translate(33 46) scale(0.68)',
  // Escorpio uses a non-uniform scale (0.72 × 0.82) to stretch
  // the figure vertically — the asterism is elongated to match
  // the scorpion's tall body. Translate (50 22) shifts right
  // onto the scorpion's body axis (which sits ~5 % right of
  // canvas centre in the art).
  escorpio: 'translate(40 22) scale(0.72 0.82)',
  geminis: 'translate(52 43) scale(0.68)',
  leo: 'translate(56 64) scale(0.68)',
  libra: 'translate(48 33) scale(0.68)',
  piscis: 'translate(42 52) scale(0.68)',
  sagitario: 'translate(16 14) scale(0.68)',
  tauro: 'translate(29 44) scale(0.68)',
  virgo: 'translate(48 46) scale(0.68)',
}
