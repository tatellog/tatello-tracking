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
    canvas: 'rgb(250, 248, 245)',
    paper: 'rgb(245, 241, 234)',
    raised: 'rgb(238, 233, 223)',
    sunken: 'rgb(232, 226, 216)',
  },
  content: {
    primary: 'rgb(28, 27, 26)',
    secondary: 'rgb(92, 88, 85)',
    tertiary: 'rgb(146, 140, 132)',
    disabled: 'rgb(183, 178, 170)',
    onAccent: 'rgb(250, 248, 245)',
  },
  border: {
    subtle: 'rgb(232, 226, 216)',
    muted: 'rgb(238, 233, 223)',
    strong: 'rgb(146, 140, 132)',
  },
  accent: {
    warm: 'rgb(184, 128, 74)',
    warmSoft: 'rgb(244, 232, 216)',
    warmStrong: 'rgb(140, 94, 52)',
    warmContrast: 'rgb(92, 60, 32)',
    cool: 'rgb(107, 142, 111)',
    coolSoft: 'rgb(225, 234, 218)',
    coolStrong: 'rgb(74, 104, 80)',
    coolContrast: 'rgb(46, 66, 50)',
  },
}

const dark: ColorScale = {
  surface: {
    canvas: 'rgb(28, 27, 26)',
    paper: 'rgb(42, 40, 38)',
    raised: 'rgb(69, 66, 63)',
    sunken: 'rgb(20, 19, 18)',
  },
  content: {
    primary: 'rgb(250, 248, 245)',
    secondary: 'rgb(232, 226, 216)',
    tertiary: 'rgb(183, 178, 170)',
    disabled: 'rgb(92, 88, 85)',
    onAccent: 'rgb(28, 27, 26)',
  },
  border: {
    subtle: 'rgb(42, 40, 38)',
    muted: 'rgb(28, 27, 26)',
    strong: 'rgb(183, 178, 170)',
  },
  accent: {
    warm: 'rgb(210, 151, 90)',
    warmSoft: 'rgb(92, 60, 32)',
    warmStrong: 'rgb(220, 172, 120)',
    warmContrast: 'rgb(244, 232, 216)',
    cool: 'rgb(107, 142, 111)',
    coolSoft: 'rgb(46, 66, 50)',
    coolStrong: 'rgb(140, 172, 145)',
    coolContrast: 'rgb(225, 234, 218)',
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
 * Shadows are kept static (anchored to light-theme charcoal). On dark
 * backgrounds they're nearly invisible, which is intentional — dark UIs
 * typically lean on elevation through surface lightness, not shadow.
 */
export const shadow = {
  sm: {
    shadowColor: light.content.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: light.content.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  lg: {
    shadowColor: light.content.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
} as const

export const fontFamily = {
  sans: 'System',
  serif: 'Fraunces_400Regular',
  serifItalic: 'Fraunces_400Regular_Italic',
  serifMedium: 'Fraunces_500Medium',
} as const

export type ColorScheme = 'light' | 'dark'
export type Color = typeof color
export type Radius = typeof radius
export type Spacing = typeof spacing
export type Shadow = typeof shadow
