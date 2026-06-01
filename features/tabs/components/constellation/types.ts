import type { ZodiacSign } from '../../zodiac/types'

export type Resolved = {
  x: number
  y: number
  mag: number
}

// 'star'/'line' are figure elements; 'field' is a padding star — an
// unconnected point of sky added so a small figure still fills the
// whole 28-day cycle. See deriveProgress.
export type SequenceEl = { type: 'star' | 'line' | 'field'; idx: number }

export type Props = {
  /** 28-day boolean array; index i is the i-th cell. */
  trained: readonly boolean[]
  todayIdx: number
  sign?: ZodiacSign
  /** When true (today is already marked as complete), the "next"
   *  affordance — the dashed magenta ring around the upcoming star,
   *  and the dashed magenta segment for the next line — is hidden.
   *  Mirrors the app's philosophy that progress is a ritual, not a
   *  debt: once you've checked in today, the figure shouldn't be
   *  whispering "one more". The ring reappears the next day. */
  committed?: boolean
  /** Show the central count chip ("3/28"). Defaults to true so the
   *  Órbita tab is unchanged. Día 1 passes false: a big "1/28" on the
   *  first day reads as "you're missing 27" — debt, which the
   *  manifiesto prohibits. There the visual loop (first star lit +
   *  next star pulsing) carries the meaning instead of a number. */
  showCount?: boolean
  /** Paint the commit firework (StarBurst) GOLD instead of magenta and
   *  push it out / amplify it into a Genshin-grade celebration. Defaults
   *  to false → the global magenta family at baseline scale, so the
   *  Órbita tab + dev/test call sites are untouched. The Home passes it:
   *  the gold burst blooming from the figure's centre outward IS the
   *  Day-1 (and every-commit) celebration now that the screen overlay
   *  is gone. */
  burstGold?: boolean
  /** Suppress the in-canvas commit burst (StarBurst) entirely. The Home
   *  passes this: its commit reward is a native Lottie firework overlay
   *  rendered above the card, so the in-SVG burst would double up. The
   *  constellation still flashes its figure on radialPulse — only the
   *  central particle burst is omitted. */
  suppressBurst?: boolean
}

export type AmbientStar = { x: number; y: number; r: number; baseOp: number; sparkle: boolean }

export type DustParticle = {
  /** X anchor 0..1 (will be multiplied by W). */
  x: number
  /** Sway amplitude in pixels. */
  sway: number
  /** Cycle period — divisor of `t` (which is an 8 s clock).
   *  E.g. period = 1.6 → particle rises every 12.8 s. */
  period: number
  /** Phase offset 0..1 so particles are staggered. */
  phase: number
  /** Particle radius in px. */
  r: number
  /** Peak opacity. */
  opacity: number
}

export type DeepStar = { x: number; y: number; r: number; op: number }
