import type { SharedValue } from 'react-native-reanimated'

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
  /** Boolean array, one cell per day of the window; index i is day i.
   *  Length = `target` (the current month's day count). */
  trained: readonly boolean[]
  todayIdx: number
  /** Days to fill before the figure completes — the month's length
   *  (28..31). Defaults to the legacy 28-day cycle. */
  target?: number
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
  /** Suppress the in-canvas commit burst (StarBurst) entirely. The Home
   *  passes this: its commit reward is a native Lottie firework overlay
   *  rendered above the card, so the in-SVG burst would double up. The
   *  constellation still flashes its figure on radialPulse — only the
   *  central particle burst is omitted. */
  suppressBurst?: boolean
  /** Pause the animation loops (in addition to the internal off-tab gate)
   *  while the Hoy ScrollView is actively scrolling OR the reward plays —
   *  frees the UI thread; the constellation freezes for the drag and resumes
   *  on release (imperceptible mid-scroll).
   *
   *  Passed as a SharedValue (1 = paused), NOT a boolean, ON PURPOSE: a
   *  boolean re-rendered the whole constellation on every scroll start/stop
   *  and every reward, and that re-render repainted the SVG + Skia layers for
   *  a frame → "el emblema brinca". The SharedValue keeps the prop reference
   *  stable (no re-render) and the loops pause/resume on the UI thread. */
  pausedSV?: SharedValue<number>
  /** DEV-only: fuerza el progreso del Emblema Celeste (0–100), ignorando
   *  el dato real y el chip DEV. Lo usa el catálogo de estados de Leo
   *  (/dev-emblem-stages) para renderizar el reveal a un % exacto. */
  transformProgressOverride?: number
  /** DEV-only: dibuja una etiqueta junto a cada estrella (su nombre si lo
   *  tiene, si no su índice) para identificarlas al afinar posiciones. */
  showStarLabels?: boolean
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
