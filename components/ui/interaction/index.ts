/**
 * Interaction signifiers — the reusable system for communicating, in under a
 * second, what is tappable / expandable / swipeable vs purely informational.
 *
 * Rule: every interactive element carries at LEAST 2 signals (e.g. shape +
 * press feedback, or chevron + active border). Informational surfaces carry
 * NONE. See docs/cta-card-hierarchy-spec.md.
 */
export { interactionTokens, type InteractionTokens } from './tokens'
export { usePressFeedback } from './usePressFeedback'
export { ChevronHint, type ChevronDirection } from './ChevronHint'
export { InteractiveGlow } from './InteractiveGlow'
export { SwipeHint } from './SwipeHint'
export { InteractivePill } from './InteractivePill'
export { InteractiveCard, type InteractiveCardVariant } from './InteractiveCard'
