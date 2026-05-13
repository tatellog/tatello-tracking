/*
 * Norte typography — Hanken Grotesk + Cormorant Garamond italic.
 *
 * Hanken Grotesk para todo el UI: display (números/titles 900 black),
 * pesos 400/500/600/700/800/900 disponibles. Cormorant Garamond
 * EXCLUSIVAMENTE en italic 500/600 para la palabra destacada y frases
 * poéticas cortas (la "soul" del Manifiesto).
 *
 * El italic no se usa con Hanken — italic = Cormorant, siempre.
 *
 * Compatibilidad: los nombres `display/displaySemi/ui/...` siguen
 * vigentes pero apuntan a Hanken. Código nuevo puede usar `serif`
 * para el énfasis Cormorant italic.
 */
export const typography = {
  // Display (Hanken 900 / 800) — números grandes, titulares
  display: 'HankenGrotesk_900Black',
  displayHeavy: 'HankenGrotesk_900Black',
  displayBold: 'HankenGrotesk_700Bold',
  displayMedium: 'HankenGrotesk_500Medium',
  displaySemi: 'HankenGrotesk_600SemiBold',

  // UI (Hanken 400/500/600/700) — labels, body, botones
  ui: 'HankenGrotesk_400Regular',
  uiMedium: 'HankenGrotesk_500Medium',
  uiSemi: 'HankenGrotesk_600SemiBold',
  uiBold: 'HankenGrotesk_700Bold',

  // Serif italic (Cormorant) — sólo para énfasis y frases cortas
  serif: 'CormorantGaramond_500Medium_Italic',
  serifSemi: 'CormorantGaramond_600SemiBold_Italic',

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
    uppercaseTight: 1.6,
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
    bold: '700' as const,
    heavy: '900' as const,
  },

  lineHeight: {
    displayTight: 0.95,
    body: 1.55,
    statement: 1.3,
  },
} as const

export type TypographyFamily =
  | 'display'
  | 'displayHeavy'
  | 'displayBold'
  | 'displayMedium'
  | 'displaySemi'
  | 'ui'
  | 'uiMedium'
  | 'uiSemi'
  | 'uiBold'
  | 'serif'
  | 'serifSemi'
