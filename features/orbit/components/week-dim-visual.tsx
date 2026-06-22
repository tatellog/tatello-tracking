import { type ReactNode } from 'react'
import { Image } from 'react-native'

import FoodVect from '@/assets/icons/food-vect.svg'

import { type WeekDimKey } from '../week-orbit-logic'

/*
 * Identidad visual de las 5 dimensiones de la Semana. Los íconos son LOS
 * MISMOS que Órbita Día (DayPresent): arte PNG dorado (movement / sueño /
 * proteína / agua) + `food-vect.svg` para comida. El glyph va en oro; el
 * COLOR de la dimensión vive en el aro/halo del nodo, no en el trazo —
 * igual que el patrón del orbital de Día.
 */
export const WEEK_DIM_COLOR: Record<WeekDimKey, string> = {
  movimiento: '#FF4886', // magenta hot (cuerpo)
  comida: '#9FE2A8', // sage (alimento)
  proteina: '#FFC56B', // oro cálido — la métrica más cuidada
  agua: '#6FD3E2', // aqua
  sueno: '#7C8FFF', // índigo (sueño)
}

// Mismos PNG dorados que usa Órbita Día (raster → <Image>, no SvgImage, para
// no sufrir el re-rasterizado que salta al hacer scroll en Android).
const MOVEMENT_PNG = require('@/assets/icons/movement.png')
const SUENO_PNG = require('@/assets/icons/sueno.png')
const PROTEIN_PNG = require('@/assets/icons/protein.png')
const AGUA_PNG = require('@/assets/icons/agua.png')

// El oro cálido de la familia de glyphs (mismo que Día para food-vect).
const GLYPH_GOLD = '#EEDD91'

/** rgba a partir de un hex #RRGGBB + alpha. */
export function hexA(hex: string, alpha: number): string {
  return `rgba(${hexRgb(hex)}, ${alpha})`
}

/** "r, g, b" a partir de un hex #RRGGBB — para gradientes Skia. */
export function hexRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

/** El glyph de la dimensión — idéntico a Órbita Día. Los PNG llenan la caja
 *  (contain); food-vect va más compacto (0.7) para pesar igual que los PNG. */
export function weekDimGlyph(key: WeekDimKey, size: number): ReactNode {
  const pngStyle = { width: size, height: size }
  const png = (src: number) => <Image source={src} style={pngStyle} resizeMode="contain" />
  const s = size * 0.7
  switch (key) {
    case 'movimiento':
      return png(MOVEMENT_PNG)
    case 'sueno':
      return png(SUENO_PNG)
    case 'proteina':
      return png(PROTEIN_PNG)
    case 'agua':
      return png(AGUA_PNG)
    case 'comida':
      return (
        <FoodVect width={s} height={s} color={GLYPH_GOLD} preserveAspectRatio="xMidYMid meet" />
      )
  }
}
