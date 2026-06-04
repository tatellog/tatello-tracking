import { type ReactNode } from 'react'

import BodyVect from '@/assets/icons/body-vect.svg'
import CycleVect from '@/assets/icons/cycle-vect.svg'
import EnergyVect from '@/assets/icons/energy-vect.svg'
import FoodVect from '@/assets/icons/food-vect.svg'
import MindVect from '@/assets/icons/mind-vect.svg'
import MoonVect from '@/assets/icons/moon-vect.svg'
import { colors } from '@/theme'

import { type DimensionKey } from '../logic'

/*
 * Dimension glyphs — illustrated plates at viewBox ~800×800, one per
 * dimension. All members of the warm-gold family (body / mind / moon /
 * food / energy / cycle) paint themselves with filled paths in the
 * `#EEDD91 / #DCCC7B / #9A8F40` palette — opacity modulation, not hue
 * shift. ENERGY and CYCLE were redrawn to match the family after the
 * UX/illustrator audit found the previous Feather utility icons broke
 * the visual register entirely.
 *
 * FOOD is the lone exception — its SVG uses `currentColor` so the same
 * file can serve the tab bar (cream) and the dimension halo (warm).
 * Its `color` prop must be set on the SVG component directly: `<G color>`
 * from a parent doesn't cross the nested `<Svg>` boundary the
 * react-native-svg-transformer generates, so currentColor would fall
 * back to black if the prop is omitted.
 */
export const GLYPHS: Record<DimensionKey, ReactNode> = {
  cuerpo: <BodyVect width={24} height={24} preserveAspectRatio="xMidYMid meet" />,
  mente: <MindVect width={24} height={24} preserveAspectRatio="xMidYMid meet" />,
  energia: <EnergyVect width={24} height={24} preserveAspectRatio="xMidYMid meet" />,
  alimento: (
    <FoodVect width={24} height={24} color={colors.leche} preserveAspectRatio="xMidYMid meet" />
  ),
  sueno: <MoonVect width={24} height={24} preserveAspectRatio="xMidYMid meet" />,
  ciclo: <CycleVect width={24} height={24} preserveAspectRatio="xMidYMid meet" />,
}
