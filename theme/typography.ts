/*
 * Sprint 2 typography — three families + numeric scale + tracking + leading.
 *
 *   display        — Cormorant Garamond, for streak number, deltas, anchor
 *   displayMedium  — 500 weight, for headline numbers that need more presence
 *   prose          — EB Garamond Italic, for narrative/conversational messages
 *   ui             — system default (SF Pro on iOS, Roboto on Android)
 *
 * Keep values inline per Sprint 2 convention:
 *   <Text style={{ fontFamily: typography.display, fontSize: typography.sizes.delta }} />
 *
 * No wrapped primitives — the spec favours inline composition so the
 * style intent lives next to the markup.
 */
export const typography = {
  display: 'CormorantGaramond_400Regular',
  displayMedium: 'CormorantGaramond_500Medium',
  prose: 'EBGaramond_400Regular_Italic',
  ui: undefined as string | undefined,

  sizes: {
    tinyLabel: 9.5,
    smallLabel: 10,
    body: 14,
    prose: 14.5,
    anchor: 22,
    delta: 34,
    streakNumber: 50,
  },

  letterSpacing: {
    label: 2,
    softLabel: 0.3,
    display: -0.8,
  },

  lineHeight: {
    tight: 0.95,
    display: 1.25,
    prose: 1.5,
  },
} as const

export type TypographyFamily = 'display' | 'displayMedium' | 'prose' | 'ui'
