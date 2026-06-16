/**
 * Interaction signifier tokens — the shared "feel" constants for every
 * tappable surface (press-feedback depth, idle/active glow, haptic style).
 * Centralised so the whole app's interactivity reads as ONE system, not a
 * pile of one-off treatments.
 */
export const interactionTokens = {
  /** Down-scale on press (1 → pressScale). */
  pressScale: 0.97,
  /** Opacity dip on press (1 → pressOpacity), when opacity feedback is on. */
  pressOpacity: 0.82,
  /** Resting halo opacity for a hero interactive element. */
  glowIdleOpacity: 0.18,
  /** Halo opacity when the element is active/focused. */
  glowActiveOpacity: 0.35,
  /** Haptic style fired on touch. */
  haptic: 'light',
} as const

export type InteractionTokens = typeof interactionTokens
