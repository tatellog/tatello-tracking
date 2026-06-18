import type { ImageSourcePropType } from 'react-native'

import type { ZodiacSign } from '@/features/tabs/zodiac/types'

// Arte del Alma Celeste — una ilustración por signo (assets/soul-art). Es la
// "siguiente forma" que nace cuando la constelación del mes se completa. Se
// revela apenas (≈10 %, durmiente) al final de la ceremonia; la pantalla
// completa de Alma Celeste (futura) la usará a pleno.
import Acuario from '@/assets/soul-art/acuario-celeste.png'
import Aries from '@/assets/soul-art/aries-celeste.png'
import Cancer from '@/assets/soul-art/cancer-celeste.png'
import Capricornio from '@/assets/soul-art/capricornio-celeste.png'
import Escorpio from '@/assets/soul-art/escorpio-celeste.png'
import Geminis from '@/assets/soul-art/geminis-celeste.png'
import Leo from '@/assets/soul-art/leo-celeste.png'
import Libra from '@/assets/soul-art/libra-celeste.png'
import Piscis from '@/assets/soul-art/piscis-celeste.png'
import Sagitario from '@/assets/soul-art/sagitario-celeste.png'
import Tauro from '@/assets/soul-art/tauro-celeste.png'
import Virgo from '@/assets/soul-art/virgo-celeste.png'

export const SOUL_ART: Record<ZodiacSign, ImageSourcePropType> = {
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
