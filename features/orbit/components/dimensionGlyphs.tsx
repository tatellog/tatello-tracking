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
 * Dimension glyphs — 24×24 line illustrations, one per dimension.
 *
 * Body / cycle / energy / mind / moon paint themselves in rose
 * (`#FFB8B3`) regardless of the parent `<G color="...">`. The rose
 * was chosen for these constellation-style illustrations because
 * cream washed out against the violet/magenta halo in focus view.
 *
 * Food is the exception — its SVG uses `currentColor` so the same
 * file can serve the tab bar and the dimension halo. The `color`
 * prop must be set on the SVG component directly: `<G color>` from
 * a parent doesn't cross the nested `<Svg>` boundary that
 * react-native-svg-transformer generates, so currentColor would
 * fall back to black if the prop is omitted.
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
