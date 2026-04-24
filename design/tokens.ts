import { useColorScheme } from 'nativewind'

/*
 * Programmatic design tokens — mirror of the semantic CSS custom properties
 * in `global.css`. Use these when Tailwind classes aren't available:
 *   - React Navigation tab bar / header tint colors
 *   - React Native shadow props
 *   - Inline styles that need a raw color string
 *
 * Components should prefer Tailwind classes (`bg-canvas`, `text-primary`) for
 * reactive theme switching via CSS. Reach for these tokens only when the
 * surface isn't styleable via className.
 *
 * Palette — "Midnight jade & rose gold":
 *   pearl = cool warm-white light surfaces
 *   cream = warm pearl used for dark-mode text
 *   jade  = deep blue-green inks (near-black in dark canvas)
 *   rose  = rose-gold warm accent
 *   sage  = cool botanical accent (dusty jade-sage)
 *
 * Dark values mirror the `.dark:root` block in global.css. When you change a
 * value there, change the matching scheme map here.
 */

type ColorScale = {
  surface: {
    canvas: string
    paper: string
    raised: string
    sunken: string
  }
  content: {
    primary: string
    secondary: string
    tertiary: string
    disabled: string
    onAccent: string
  }
  border: {
    subtle: string
    muted: string
    strong: string
  }
  accent: {
    warm: string
    warmSoft: string
    warmStrong: string
    warmContrast: string
    cool: string
    coolSoft: string
    coolStrong: string
    coolContrast: string
  }
}

const light: ColorScale = {
  surface: {
    canvas: 'rgb(243, 240, 235)',
    paper: 'rgb(232, 226, 215)',
    raised: 'rgb(218, 210, 195)',
    sunken: 'rgb(196, 188, 172)',
  },
  content: {
    primary: 'rgb(20, 48, 40)',
    secondary: 'rgb(40, 70, 60)',
    tertiary: 'rgb(78, 108, 98)',
    disabled: 'rgb(100, 130, 120)',
    onAccent: 'rgb(250, 248, 243)',
  },
  border: {
    subtle: 'rgb(218, 210, 195)',
    muted: 'rgb(232, 226, 215)',
    strong: 'rgb(78, 108, 98)',
  },
  accent: {
    warm: 'rgb(184, 131, 117)',
    warmSoft: 'rgb(244, 220, 210)',
    warmStrong: 'rgb(138, 90, 76)',
    warmContrast: 'rgb(78, 45, 35)',
    cool: 'rgb(107, 128, 121)',
    coolSoft: 'rgb(210, 225, 215)',
    coolStrong: 'rgb(78, 100, 92)',
    coolContrast: 'rgb(38, 55, 48)',
  },
}

const dark: ColorScale = {
  surface: {
    canvas: 'rgb(11, 30, 26)',
    paper: 'rgb(21, 44, 39)',
    raised: 'rgb(40, 70, 60)',
    sunken: 'rgb(7, 22, 19)',
  },
  content: {
    primary: 'rgb(244, 237, 220)',
    secondary: 'rgb(218, 210, 195)',
    tertiary: 'rgb(140, 165, 155)',
    disabled: 'rgb(78, 108, 98)',
    onAccent: 'rgb(11, 30, 26)',
  },
  border: {
    subtle: 'rgb(21, 44, 39)',
    muted: 'rgb(20, 48, 40)',
    strong: 'rgb(159, 184, 168)',
  },
  accent: {
    warm: 'rgb(212, 162, 144)',
    warmSoft: 'rgb(78, 45, 35)',
    warmStrong: 'rgb(225, 180, 165)',
    warmContrast: 'rgb(244, 220, 210)',
    cool: 'rgb(120, 150, 135)',
    coolSoft: 'rgb(38, 55, 48)',
    coolStrong: 'rgb(159, 184, 168)',
    coolContrast: 'rgb(210, 225, 215)',
  },
}

export const color = { light, dark }

/*
 * Reactive color lookup. Call from components that need raw color strings
 * (tab bars, native Navigation headers) so they track the active scheme.
 */
export function useColors(): ColorScale {
  const { colorScheme } = useColorScheme()
  return colorScheme === 'dark' ? dark : light
}

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

/*
 * Shadows anchor to the light-theme jade ink so they carry a subtle blue-
 * green undertone — on-brand and almost imperceptible at the chosen opacities.
 * On dark surfaces they're nearly invisible, which is intentional.
 */
export const shadow = {
  sm: {
    shadowColor: light.content.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: light.content.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  lg: {
    shadowColor: light.content.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
} as const

export const fontFamily = {
  sans: 'Geist_400Regular',
  sansMedium: 'Geist_500Medium',
  serif: 'Fraunces_400Regular',
  serifItalic: 'Fraunces_400Regular_Italic',
  serifMedium: 'Fraunces_500Medium',
} as const

export type ColorScheme = 'light' | 'dark'
export type Color = typeof color
export type Radius = typeof radius
export type Spacing = typeof spacing
export type Shadow = typeof shadow
