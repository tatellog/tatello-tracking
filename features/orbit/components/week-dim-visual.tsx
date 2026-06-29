import { type ReactNode } from 'react'
import { Image } from 'react-native'

import FoodVect from '@/assets/icons/food-vect.svg'

import { type WeekDimKey } from '../week-orbit-logic'

/*
 * Identidad visual de las 5 dimensiones de la Semana. Los íconos son LOS
 * MISMOS que Órbita Día (DayPresent): arte PNG (movement / sueño / proteína /
 * agua) + `food-vect.svg` para comida. Cada ícono se TINTA a SU color de
 * dimensión (el mismo del aro), no al oro — cohesión pedida por la owner.
 */
export const WEEK_DIM_COLOR: Record<WeekDimKey, string> = {
  movimiento: '#FF4886', // magenta hot (cuerpo)
  comida: '#9FE2A8', // sage (alimento)
  proteina: '#FFC56B', // oro cálido — la métrica más cuidada
  agua: '#6FD3E2', // aqua
  sueno: '#7C8FFF', // índigo (sueño)
  energia: '#FF8A5C', // coral cálido (energía)
}

// Mismos PNG que usa Órbita Día (raster → <Image>, no SvgImage, para no sufrir
// el re-rasterizado que salta al hacer scroll en Android).
const MOVEMENT_PNG = require('@/assets/icons/movement.png')
const SUENO_PNG = require('@/assets/icons/sueno.png')
const PROTEIN_PNG = require('@/assets/icons/protein.png')
const AGUA_PNG = require('@/assets/icons/agua.png')
const ENERGIA_PNG = require('@/assets/icons/energia.png')

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

/* Escala óptica por ícono — el "peso visual" difiere entre piezas (una gota o
 * una luna sólidas llenan más que un runner diagonal de trazo fino), así que un
 * mismo `size` no se ve parejo. AGUA es la referencia (1.0): la owner pidió que
 * los demás se vean tan grandes como agua. Fáciles de ajustar a ojo. */
const GLYPH_SCALE: Record<WeekDimKey, number> = {
  agua: 1.0, // referencia
  movimiento: 1.5, // runner: figura diagonal y fina, necesita más para pesar igual
  sueno: 1.3,
  proteina: 1.25,
  comida: 1.0, // food-vect (antes 0.7), ahora pesa como las demás
  energia: 1.3, // rayo de trazo medio
}

/** El glyph de la dimensión, tintado a SU color (el mismo del aro). Mismos
 *  íconos que Órbita Día. `tintColor` aplana el arte a ese color conservando el
 *  alpha; el contenido (contain) se centra en el contenedor que lo monta. */
export function weekDimGlyph(key: WeekDimKey, size: number): ReactNode {
  const tint = WEEK_DIM_COLOR[key]
  const s = size * GLYPH_SCALE[key]
  if (key === 'comida') {
    return <FoodVect width={s} height={s} color={tint} preserveAspectRatio="xMidYMid meet" />
  }
  const src =
    key === 'movimiento'
      ? MOVEMENT_PNG
      : key === 'sueno'
        ? SUENO_PNG
        : key === 'proteina'
          ? PROTEIN_PNG
          : key === 'energia'
            ? ENERGIA_PNG
            : AGUA_PNG
  return (
    <Image source={src} style={{ width: s, height: s, tintColor: tint }} resizeMode="contain" />
  )
}
