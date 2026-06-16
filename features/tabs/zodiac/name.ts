import { ZODIAC } from './data'
import type { ZodiacSign } from './types'

/** Nombre del signo en title case para el copy del coach: "Tauro",
 *  "Géminis", "Cáncer". El `label` de ZODIAC es UPPERCASE (se pinta en la
 *  cápsula de la constelación), así que no sirve tal cual para una frase. */
export function signName(sign: ZodiacSign): string {
  const label = ZODIAC[sign].label
  return label.charAt(0) + label.slice(1).toLowerCase()
}
