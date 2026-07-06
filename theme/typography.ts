/**
 * Norte typography — Hanken Grotesk + Cormorant Garamond italic.
 *
 *   - Hanken is the only sans (display + UI). Use the weighted
 *     aliases (`displayHeavy`, `uiBold`, etc.) so swapping weights
 *     stays a one-line change.
 *   - Cormorant Garamond is used EXCLUSIVELY in italic for the
 *     emphasised word + short poetic lines. Reach for `serif` /
 *     `serifSemi` only there.
 *   - Italic is reserved for the serif. Hanken stays upright.
 */
export const typography = {
  // Display sans (Hanken)
  display: 'HankenGrotesk_900Black',
  displayHeavy: 'HankenGrotesk_900Black',
  displayMedium: 'HankenGrotesk_500Medium',
  displaySemi: 'HankenGrotesk_600SemiBold',

  // UI sans (Hanken)
  ui: 'HankenGrotesk_400Regular',
  uiMedium: 'HankenGrotesk_500Medium',
  uiSemi: 'HankenGrotesk_600SemiBold',
  uiBold: 'HankenGrotesk_700Bold',

  // Serif italic (Cormorant)
  serif: 'CormorantGaramond_500Medium_Italic',
  serifSemi: 'CormorantGaramond_600SemiBold_Italic',

  sizes: {
    nano: 7,
    tinyLabel: 9,
    smallLabel: 10,
    micro: 11,
    caption: 11.5,
    label: 12,
    body: 13,
    bodyLarge: 14,
    ui: 15,
    title: 16,
    anchor: 17,
    heading: 18,
    headingLg: 20,
    segmentTitle: 22,
    displaySm: 24,
    // ── Tier display (E1 · 5 jul 2026): los héroes tipográficos dejan de
    // ser literales sueltos. Consolidar vecinos (32/36/38) es decisión de
    // dueña aparte — esto solo DECLARA la realidad para poder verla.
    displayMd: 26,
    // (tilePlus, duplicado exacto de deltaNum, se fusionó el 5 jul 2026.)
    deltaNum: 28,
    macroNum: 30,
    displayLg: 32,
    displayHero: 34,
    displayTitle: 36,
    displayXl: 38,
    wheelSm: 40,
    gaugeNum: 44,
    statHero: 46,
    streakNum: 48,
    heroNum: 52,
    wheelNum: 54,
    inputNum: 56,
    sliderNum: 58,
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
  | 'displayMedium'
  | 'displaySemi'
  | 'ui'
  | 'uiMedium'
  | 'uiSemi'
  | 'uiBold'
  | 'serif'
  | 'serifSemi'
