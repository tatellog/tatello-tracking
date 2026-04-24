import { Easing } from 'react-native-reanimated'

/*
 * Motion tokens — opinionated, shared. Every animation in the app
 * should borrow from these durations + easings instead of inlining
 * one-off numbers, so the whole product feels like one motion
 * language rather than a mix of dialects.
 *
 * Philosophy: "the app is calm". Durations skew to the slower side
 * so nothing feels flicky. Easings skew to `out` curves so motion
 * lands softly rather than overshooting.
 */
export const duration = {
  // Tap feedback, toggles, state flips. Imperceptibly fast.
  quick: 150,
  // Default for cards, sheets, inline transitions.
  standard: 250,
  // Hero transitions — photo taps, screen reveals, ring fills.
  slow: 400,
  // Editorial entrance — 'the brief is opening', sent confirmations.
  // Use sparingly.
  languid: 600,
} as const

export const easing = {
  // Motion decelerates into rest. Default for fade-outs, releases.
  out: Easing.out(Easing.cubic),
  // Motion accelerates away. Default for fade-ins, entrances.
  in: Easing.in(Easing.cubic),
  // Material-standard bidirectional. Natural for focus/blur states.
  standard: Easing.bezier(0.4, 0, 0.2, 1),
  // iOS-flavoured soft decel. Scroll-adjacent motion.
  soft: Easing.bezier(0.25, 0.1, 0.25, 1),
} as const

/*
 * Stagger intervals for composed entrance sequences. Apply in the
 * order the eye should land (first element `0`, next `step1`, etc).
 * Intervals below ~120 ms prevent the sequence from feeling like a
 * slideshow.
 */
export const stagger = {
  step1: 80,
  step2: 160,
  step3: 240,
  step4: 320,
} as const

export type Duration = keyof typeof duration
export type Stagger = keyof typeof stagger
