import { type ReactNode } from 'react'

import BodyVect from '@/assets/icons/body-vect.svg'
import CycleVect from '@/assets/icons/cycle-vect.svg'
import EnergyVect from '@/assets/icons/energy-vect.svg'
import FoodVect from '@/assets/icons/food-vect.svg'
import MindVect from '@/assets/icons/mind-vect.svg'
import MoonVect from '@/assets/icons/moon-vect.svg'
import { type DimensionKey } from '../logic'

/*
 * Dimension glyphs — 24×24 line illustrations, one per dimension.
 *
 * The SVGs are tintable: every fill is `currentColor`, so the
 * paint is whatever colour the parent `<G color="...">` provides.
 * That keeps a single source of truth — `theme/colors.ts` — for
 * what tint the glyph reads as in each context (cream as a bright
 * core inside the coloured halo, dimension colour for solo chips,
 * etc).
 */
export const GLYPHS: Record<DimensionKey, ReactNode> = {
  cuerpo: <BodyVect width={24} height={24} preserveAspectRatio="xMidYMid meet" />,
  mente: <MindVect width={24} height={24} preserveAspectRatio="xMidYMid meet" />,
  energia: <EnergyVect width={24} height={24} preserveAspectRatio="xMidYMid meet" />,
  alimento: <FoodVect width={24} height={24} preserveAspectRatio="xMidYMid meet" />,
  sueno: <MoonVect width={24} height={24} preserveAspectRatio="xMidYMid meet" />,
  ciclo: <CycleVect width={24} height={24} preserveAspectRatio="xMidYMid meet" />,
}
