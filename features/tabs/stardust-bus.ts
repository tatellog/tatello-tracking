/*
 * Bus del polvo de estrellas (comida registrada → estrellas al emblema).
 * Mismo patrón que celebrate-bus: Hoy emite con la geometría en coordenadas
 * de ventana (tarjeta de comidas y emblema) y el overlay global la pinta.
 */
import type { SharedValue } from 'react-native-reanimated'

import type { StardustGeo } from './stardust-logic'

export type StardustPayload = StardustGeo & {
  /** Esta tanda cruzó una etapa de Descubre: al final, "Stelar encontró algo". */
  discovered: boolean
  /** El scroll de la pantalla (hilo de UI) y su valor al medir: la capa se
   *  desplaza con la página para que las estrellas sigan al emblema. */
  scrollY?: SharedValue<number>
  scrollY0?: number
}

type Listener = (payload: StardustPayload) => void

const listeners = new Set<Listener>()

export function emitStardust(payload: StardustPayload): void {
  listeners.forEach((fn) => fn(payload))
}

export function subscribeStardust(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
