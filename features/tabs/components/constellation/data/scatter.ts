import { colors } from '@/theme'

import { AMBIENT_BUCKET_COUNT, AMBIENT_STAR_COUNT, H, W } from '../constants'
import type { AmbientStar, DeepStar, DustParticle } from '../types'

// Deterministic field that avoids the centre block where the day
// counter lives. The seed math is intentionally noisy — `Math.sin` of
// large integers gives us a stable pseudo-random sequence without
// pulling in a PRNG. Stars are bucketed by index so the twinkle stays
// cheap (one worklet per bucket, not per star).
export function buildAmbientField(): AmbientStar[][] {
  const buckets: AmbientStar[][] = Array.from({ length: AMBIENT_BUCKET_COUNT }, () => [])
  for (let i = 0; i < AMBIENT_STAR_COUNT; i++) {
    const a = Math.sin(i * 47.1 + 3.7)
    const b = Math.sin(i * 91.3 + 1.1)
    const x = ((((a * 9301 + 49297) % 1) + 1) % 1) * W
    const y = ((((b * 8101 + 26183) % 1) + 1) % 1) * H
    const dx = x - W / 2
    const dy = y - H / 2
    if (dx * dx + dy * dy < 3200) continue
    // Varied magnitudes for depth — most stars tiny + dim, but a
    // few are larger + brighter to fake parallax distance. The
    // brightest ~10% earn a 4-point sparkle so they feel like
    // background gems catching light, not just dots.
    const mag = Math.abs(a * b)
    const baseOp = 0.03 + mag * 0.22
    const r = 0.3 + Math.abs(a) * 1.7
    const sparkle = mag > 0.55
    const bucket = i % AMBIENT_BUCKET_COUNT
    buckets[bucket]!.push({ x, y, r, baseOp, sparkle })
  }
  return buckets
}

export const DUST: readonly DustParticle[] = [
  { x: 0.18, sway: 8, period: 1.6, phase: 0.0, r: 0.9, opacity: 0.55 },
  { x: 0.32, sway: 5, period: 2.1, phase: 0.27, r: 0.6, opacity: 0.4 },
  { x: 0.48, sway: 10, period: 1.8, phase: 0.55, r: 1.1, opacity: 0.6 },
  { x: 0.62, sway: 6, period: 2.4, phase: 0.13, r: 0.7, opacity: 0.45 },
  { x: 0.74, sway: 9, period: 1.7, phase: 0.71, r: 0.8, opacity: 0.5 },
  { x: 0.86, sway: 4, period: 2.2, phase: 0.41, r: 0.55, opacity: 0.4 },
  { x: 0.08, sway: 7, period: 1.95, phase: 0.84, r: 0.75, opacity: 0.45 },
] as const

// Winks viven en los MÁRGENES, fuera de donde se asienta la figura del
// signo (centro del lienzo). El destello blanco de 4 puntas se lee como una
// estrella de la constelación suelta si cae arriba-izquierda, así que ahí no
// hay ninguno: el wink superior-izquierdo se retiró.
export const WINK_POSITIONS = [
  { x: 0.84, y: 0.24, period: 5.2, phase: 0.27, size: 2.8 },
  { x: 0.78, y: 0.78, period: 4.7, phase: 0.51, size: 3.2 },
  { x: 0.09, y: 0.88, period: 5.6, phase: 0.73, size: 2.6 },
  { x: 0.52, y: 0.08, period: 4.9, phase: 0.39, size: 3.0 },
] as const

// Magenta-family hues — the per-spark micro-shift stays inside the
// brand. The burst never changes *kind*, only texture.
export const SPARK_HUES = [colors.magenta, colors.magentaHot, '#FF8FC0']

// Ultra-far depth layer — 30 micro-stars at very low opacity that
// drift 6× slower than the ambient field. Pure parallax cue: you
// rarely notice them, but their slow shift behind the ambient field
// adds real depth to the cosmos.
export const DEEP_STARS: DeepStar[] = (() => {
  const out: DeepStar[] = []
  for (let i = 0; i < 30; i++) {
    const a = Math.sin(i * 53.3 + 7.1)
    const b = Math.sin(i * 71.9 + 2.7)
    const x = ((((a * 9301 + 49297) % 1) + 1) % 1) * W
    const y = ((((b * 8101 + 26183) % 1) + 1) % 1) * H
    // Keep deep stars out of the immediate center where the chip lives.
    const dx = x - W / 2
    const dy = y - H / 2
    if (dx * dx + dy * dy < 2400) continue
    const r = 0.3 + Math.abs(a) * 0.4
    const op = 0.06 + Math.abs(a * b) * 0.1
    out.push({ x, y, r, op })
  }
  return out
})()

// Per-bucket parallax — each bucket drifts with its own direction
// amplitude so the field layers feel depth-staggered. Multiplied by
// the slow `drift` clock (60 s loop) so motion is barely perceptible
// frame-to-frame but clear if you watch for ~15 s.
export const BUCKET_DRIFT = [
  { ax: 9, ay: 6, phase: 0.0 },
  { ax: 6, ay: 11, phase: 0.22 },
  { ax: 12, ay: 4, phase: 0.48 },
  { ax: 4, ay: 9, phase: 0.71 },
  { ax: 8, ay: 7, phase: 0.88 },
] as const

// Six dust motes scattered in fixed offsets around the lit cluster
// centroid. Each twinkles on its own phase so the field never reads
// as synchronised pulses — looks like dust catching the cluster's
// warm light. Frequency 1.4 × the 8 s clock so the twinkles read
// faster than the breath.
export const MOTE_LAYOUT = [
  { dx: 0.42, dy: -0.58, phase: 0.13 },
  { dx: -0.52, dy: -0.32, phase: 0.27 },
  { dx: -0.34, dy: 0.48, phase: 0.41 },
  { dx: 0.58, dy: 0.22, phase: 0.55 },
  { dx: 0.18, dy: 0.72, phase: 0.69 },
  { dx: -0.7, dy: -0.08, phase: 0.83 },
] as const

// Burst spark angles — 8 directions, slightly off-cardinal so the
// pattern reads as organic (not a perfect compass rose).
export const BURST_ANGLES = [12, 57, 102, 147, 192, 237, 282, 327] as const
