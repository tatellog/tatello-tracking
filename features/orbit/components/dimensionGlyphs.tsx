import { type ReactNode } from 'react'

import BodyVect from '@/assets/icons/body-vect.svg'
import CycleVect from '@/assets/icons/cycle-vect.svg'
import EnergyVect from '@/assets/icons/energy-vect.svg'
import FoodVect from '@/assets/icons/food-vect-rose.svg'
import MindVect from '@/assets/icons/mind-vect.svg'
import MoonVect from '@/assets/icons/moon-vect.svg'
import { type DimensionKey } from '../logic'

/*
 * Illustrated rose-gold dimension glyphs. All six are now TRUE
 * vector SVGs imported via react-native-svg-transformer and
 * rendered at 24×24 inside the StarNode's parent SVG.
 *
 * Migrated from a mix of inline <Path> + Figma-export raster
 * PNGs to a homogeneous vector source — sharper at any scale,
 * one render pipeline, smaller install footprint.
 *
 * Note: the vector files use hard-coded fills (rose-pink
 * palette), so they don't inherit `currentColor` even though
 * they're vector. If we ever want per-dimension tinting, the
 * SVGs need their paths rewritten to use `currentColor` for
 * fill/stroke.
 */
export const GLYPHS: Record<DimensionKey, ReactNode> = {
  cuerpo: <BodyVect width={24} height={24} preserveAspectRatio="xMidYMid meet" />,
  mente: <MindVect width={24} height={24} preserveAspectRatio="xMidYMid meet" />,
  energia: <EnergyVect width={24} height={24} preserveAspectRatio="xMidYMid meet" />,
  alimento: <FoodVect width={24} height={24} preserveAspectRatio="xMidYMid meet" />,
  sueno: <MoonVect width={24} height={24} preserveAspectRatio="xMidYMid meet" />,
  ciclo: <CycleVect width={24} height={24} preserveAspectRatio="xMidYMid meet" />,
}
