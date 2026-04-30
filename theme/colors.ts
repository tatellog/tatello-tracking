/*
 * Pearl Mauve — sistema de diseño bicromático (ink + mauve sobre pearl).
 *
 * Reglas duras:
 *   - Cero hex sueltos en componentes. Cualquier color va via tokens.
 *   - Si necesitás un color que no está, agregalo aquí primero.
 *   - El verde feedbackSuccess solo para confirmaciones, no decoración.
 */
export const colors = {
  // Backgrounds (pearl family)
  pearlBase: '#FAFAFB',
  pearlElevated: '#FFFFFF',
  pearlMuted: '#F0EEF2',

  // Text (ink family)
  inkPrimary: '#1C1A1F',
  inkSoft: '#3E3A42',
  labelMuted: '#7A737E',
  labelDim: '#B0A8B4',

  // Accent (mauve family)
  mauveLight: '#C9879E',
  mauveDeep: '#A85E7C',
  mauveShadow: 'rgba(168, 94, 124, 0.25)',

  // Borders / dividers
  borderSubtle: '#E8E3EB',
  borderDashed: '#D8D2DC',

  // Dark surfaces
  inkDark: '#1C1A1F',
  inkDarkHighlight: '#2A252E',

  // Shadows / overlays
  shadowCard: 'rgba(28, 26, 31, 0.08)',
  shadowLift: 'rgba(28, 26, 31, 0.15)',

  // Feedback colors
  feedbackSuccess: '#5A6F4C',
  feedbackError: '#B85045',

  // Sprint 2.6 — onboarding wizard surfaces.
  // pearlGradientEnd is the bottom of the subtle pearl→tinted gradient
  // that sits behind every wizard step. mauveTinted is the fill of a
  // SelectableCard once the user picks it — strong enough to read,
  // light enough not to wreck the card column rhythm. mauveBorderSoft
  // is the dashed border for empty photo slots (less assertive than
  // mauveDeep so the slot reads "to do" instead of "active"). The two
  // cameraDark tokens are top/bottom of the camera viewport gradient,
  // designed to recede behind the silhouette overlay.
  pearlGradientEnd: '#F5EFF2',
  mauveTinted: '#F8F0F4',
  mauveBorderSoft: '#D8B5C4',
  cameraDark: '#2A2530',
  cameraDarkBottom: '#1F1A24',
} as const

export type ColorToken = keyof typeof colors
