import type { ZodiacEngravingProps } from '../../ZodiacEngraving'
import type { ZodiacSign } from '../../../zodiac/types'

// PNG rasterizado (no el .svg de ~500 KB con miles de paths). El arte se
// muestra a tamaño fijo en la card, así que un PNG a 3x (1024 px) se ve
// idéntico pero renderiza como UNA textura GPU en vez de re-rasterizar miles
// de paths por frame — el cuello de botella real de la constelación en Android.
// Regenerar con: node scripts/gen-zodiac-png.mjs
import AcuarioArt from '@/assets/zodiac-art/acuario-art.png'
import AriesArt from '@/assets/zodiac-art/aries-art.png'
import CancerArt from '@/assets/zodiac-art/cancer-art.png'
import CapricornioArt from '@/assets/zodiac-art/capricornio-art.png'
import EscorpioArt from '@/assets/zodiac-art/escorpio-art.png'
import GeminisArt from '@/assets/zodiac-art/geminis-art.png'
import LeoArt from '@/assets/zodiac-art/leo-art.png'
import LibraArt from '@/assets/zodiac-art/libra-art.png'
import PiscisArt from '@/assets/zodiac-art/piscis-art.png'
import SagitarioArt from '@/assets/zodiac-art/sagitario-art.png'
import TauroArt from '@/assets/zodiac-art/tauro-art.png'
import VirgoArt from '@/assets/zodiac-art/virgo-art.png'

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

/**
 * Per-sign constellation transform · cada figura tiene su propio bbox
 * natural, así que el translate/scale que la encaja dentro del anillo
 * ornamentado varía por signo. La constelación lo aplica en JS (Skia /
 * Lottie no pueden parsear un `transform` SVG dentro de un worklet), así
 * que estos parámetros numéricos son la ÚNICA fuente de verdad.
 */
export const SIGN_CONSTELLATION_TRANSFORM_PARAMS: Record<
  ZodiacSign,
  { tx: number; ty: number; sx: number; sy: number }
> = {
  acuario: { tx: 47, ty: 41, sx: 0.68, sy: 0.68 },
  aries: { tx: 46, ty: 37, sx: 0.68, sy: 0.68 },
  cancer: { tx: 45, ty: 40, sx: 0.68, sy: 0.68 },
  capricornio: { tx: 33, ty: 46, sx: 0.68, sy: 0.68 },
  // Escorpio: escala no-uniforme (0.72×0.82) para estirar la figura
  // vertical (el escorpión es alargado); translate (40 22) la corre a su
  // eje, ~5% a la derecha del centro del lienzo.
  escorpio: { tx: 40, ty: 22, sx: 0.72, sy: 0.82 },
  geminis: { tx: 52, ty: 43, sx: 0.68, sy: 0.68 },
  // Leo: busto cabeza+melena de perfil a la izquierda. Escala grande (0.82)
  // para llenar cara+melena; las estrellas derechas (Zosma/Denebola) están
  // metidas en figures.ts para no tocar la ramita floral ni la luna.
  leo: { tx: 38, ty: 42, sx: 0.82, sy: 0.82 },
  libra: { tx: 48, ty: 33, sx: 0.68, sy: 0.68 },
  piscis: { tx: 42, ty: 52, sx: 0.68, sy: 0.68 },
  sagitario: { tx: 16, ty: 14, sx: 0.68, sy: 0.68 },
  tauro: { tx: 29, ty: 44, sx: 0.68, sy: 0.68 },
  virgo: { tx: 48, ty: 46, sx: 0.68, sy: 0.68 },
}
