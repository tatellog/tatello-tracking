import type { ZodiacDef } from '../../../zodiac/types'
import { TARGET_DAYS } from '../constants'
import type { SequenceEl } from '../types'

/* Deterministic scatter of `count` unconnected "field" stars across
 * the canvas, kept clear of the centre counter and of the figure's
 * own stars. Same positions every render (seeded by index). */
export function buildFieldStars(
  figureStars: readonly { x: number; y: number }[],
  count: number,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  let i = 0
  while (out.length < count && i < count * 60 + 60) {
    const a = Math.sin(i * 73.13 + 2.1)
    const b = Math.sin(i * 31.77 + 5.9)
    i++
    const x = 0.06 + ((Math.abs(a) * 1000) % 1) * 0.88
    const y = 0.06 + ((Math.abs(b) * 1000) % 1) * 0.88
    // Skip the centre — that's where the day counter sits.
    const dcx = x - 0.5
    const dcy = y - 0.5
    if (dcx * dcx + dcy * dcy < 0.21 * 0.21) continue
    // Skip anything sitting on top of a figure star.
    let collides = false
    for (const fs of figureStars) {
      const ex = x - fs.x
      const ey = y - fs.y
      if (ex * ex + ey * ey < 0.065 * 0.065) {
        collides = true
        break
      }
    }
    if (collides) continue
    out.push({ x, y })
  }
  return out
}

/** Figure size for a sign = its stars + its connecting lines. This is
 *  the achievable completion goal (the asterism "brilla entera"), kept
 *  well under a month so finishing it never demands training every day
 *  — rest stays welcome (manifiesto: sin presión). */
export function figureElementCount(zodiac: ZodiacDef): number {
  return zodiac.stars.length + zodiac.lines.length
}

export function deriveProgress(
  trained: readonly boolean[],
  todayIdx: number,
  zodiac: ZodiacDef,
  /** The month's length (28..31) — the cap for how many "luz extra"
   *  field stars can light after the figure is done. Defaults to the
   *  legacy 28-day cycle. */
  target: number = TARGET_DAYS,
): {
  trainedCount: number
  elementsLit: number
  sequence: SequenceEl[]
  fieldStars: { x: number; y: number }[]
  /** Total figure elements (stars + lines) — the completion goal. */
  figureCount: number
  /** The figure (asterism) is fully lit — THE milestone/reward. */
  figureComplete: boolean
  /** Days trained beyond the figure — "luz extra" bonus stars. */
  extraLit: number
  /** Legacy: every day of the month lit. No longer the reward trigger
   *  (that's `figureComplete`); kept for callers that still read it. */
  isComplete: boolean
  /** Overflow intensifier — now always 0: the figure is padded with
   *  field stars to exactly TARGET_DAYS elements, so there is never
   *  an overflow phase. Kept in the shape for LitStar's signature. */
  intensity: number
} {
  const count = trained.slice(0, todayIdx + 1).filter(Boolean).length
  const nStars = zodiac.stars.length

  // ── Figure sequence — stars + lines, each line preceded by both
  //    its endpoint stars; leftover stars trail at the end. ──
  const figureSeq: SequenceEl[] = []
  const seen = new Set<number>()
  if (nStars > 0) {
    figureSeq.push({ type: 'star', idx: 0 })
    seen.add(0)
  }
  zodiac.lines.forEach((ln, lineIdx) => {
    const [a, b] = ln
    if (!seen.has(a)) {
      figureSeq.push({ type: 'star', idx: a })
      seen.add(a)
    }
    if (!seen.has(b)) {
      figureSeq.push({ type: 'star', idx: b })
      seen.add(b)
    }
    figureSeq.push({ type: 'line', idx: lineIdx })
  })
  for (let i = 0; i < nStars; i++) {
    if (!seen.has(i)) figureSeq.push({ type: 'star', idx: i })
  }

  // ── The figure leads (front-loaded), then "luz extra" field stars
  //    fill the rest of the month. So the asterism completes at an
  //    achievable count (figureCount, ~11–18), the reward fires there,
  //    and every day after is bonus light — never a debt. ──
  const figureCount = figureSeq.length
  const fieldStars = buildFieldStars(zodiac.stars, Math.max(0, target - figureCount))
  const seq: SequenceEl[] = [
    ...figureSeq,
    ...fieldStars.map((_, i) => ({ type: 'field' as const, idx: i })),
  ]

  return {
    trainedCount: count,
    elementsLit: Math.min(count, seq.length),
    sequence: seq,
    fieldStars,
    figureCount,
    figureComplete: count >= figureCount,
    extraLit: Math.max(0, count - figureCount),
    isComplete: count >= target,
    intensity: 0,
  }
}
