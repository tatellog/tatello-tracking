/*
 * Pearl Mauve typography — solo Inter + Inter Tight.
 *
 * Inter Tight para números display y elementos prominentes.
 * Inter para labels, body, botones, todo lo que es UI funcional.
 *
 * NO usar serif. NO usar Cormorant, EB Garamond, Playfair, Georgia.
 * NO usar italic en ningún caso — la estética italic prose era boda.
 * Lo que antes era italic prose es ahora UPPERCASE Inter Medium con
 * letter-spacing wide.
 */
export const typography = {
  // Display sans (números prominentes)
  display: 'InterTight_300Light',
  displayMedium: 'InterTight_400Regular',
  displaySemi: 'InterTight_500Medium',

  // UI sans (labels, body, botones)
  ui: 'Inter_400Regular',
  uiMedium: 'Inter_500Medium',
  uiSemi: 'Inter_600SemiBold',

  sizes: {
    tinyLabel: 9,
    smallLabel: 10,
    caption: 11.5,
    body: 13,
    bodyLarge: 14,
    anchor: 17,
    deltaNum: 28,
    streakNum: 48,
    macroNum: 30,
    tilePlus: 28,
  },

  letterSpacing: {
    uppercaseWide: 2.4,
    uppercaseMed: 1.8,
    displayTight: -2,
    displayMed: -1,
    default: 0,
    bodyLoose: 0.3,
  },

  fontWeight: {
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semi: '600' as const,
  },

  lineHeight: {
    displayTight: 0.95,
    body: 1.55,
    statement: 1.3,
  },
} as const

export type TypographyFamily =
  | 'display'
  | 'displayMedium'
  | 'displaySemi'
  | 'ui'
  | 'uiMedium'
  | 'uiSemi'
