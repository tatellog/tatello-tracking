import { Easing } from 'react-native-reanimated'

/*
 * Motion tokens — a small, opinionated system. Every animation in the app
 * should borrow its duration and easing from here, not pick bespoke numbers.
 * This keeps motion feeling like one coordinated language rather than a mix
 * of dialects.
 *
 * Philosophy: "the app is calm". Durations lean on the slower side so
 * nothing feels flicky; easings lean on `out` curves so motion lands softly
 * rather than overshooting.
 */

export const duration = {
  // Tap feedback, toggles — imperceptible fast. Avoids feeling laggy.
  quick: 150,
  // Standard transitions (cards, sheets). The default pick.
  standard: 250,
  // Hero transitions — photo taps, screen-level reveals.
  slow: 400,
  // Page-turn, editorial entrance. Use sparingly; reserved for "the brief
  // is opening" or "a chapter begins".
  languid: 600,
} as const

export const easing = {
  // Exit curve — motion decelerates into rest. Default for fade-outs.
  out: Easing.out(Easing.cubic),
  // Entrance curve — motion accelerates away. Default for fade-ins.
  in: Easing.in(Easing.cubic),
  // Material-standard ease. Natural for bidirectional transitions.
  standard: Easing.bezier(0.4, 0, 0.2, 1),
  // iOS-feeling soft decel. Good for scroll-adjacent motion.
  soft: Easing.bezier(0.25, 0.1, 0.25, 1),
} as const

/*
 * Semantic stagger intervals for composed entrance sequences. Apply in the
 * order the eye should land: the first element gets `0`, the next `step1`,
 * etc. Keeping intervals below ~120 ms prevents the sequence from feeling
 * like a slideshow.
 */
export const stagger = {
  step1: 80,
  step2: 160,
  step3: 240,
  step4: 320,
} as const

export type Duration = typeof duration
export type Easing_ = typeof easing
export type Stagger = typeof stagger
