import type { CyclePhase } from './phase'

/*
 * Pure geometry for the cycle ORBITAL RING (CycleRing.tsx) — the
 * celestial replacement for the old linear cycle timeline. No side
 * effects, fully testable, same spirit as phase.ts.
 *
 * The ring is a clock face: day 1 sits at the top (12 o'clock) and the
 * "today" point travels CLOCKWISE around the border as the cycle
 * advances, like a moon along its orbit. A small gap stays open at the
 * very top — that seam is the cycle boundary (where one cycle closes and
 * the next begins).
 *
 * The four phase arcs MUST match phaseForDay() in phase.ts exactly, so
 * the lit arc always agrees with the phase label and the day number.
 */

const TAU = Math.PI * 2

/** Day (1..length) → angle in radians. Day 1 at top (−90°), clockwise. */
export function dayToAngle(day: number, length: number): number {
  return -Math.PI / 2 + ((day - 1) / length) * TAU
}

export function pointOnRing(
  cx: number,
  cy: number,
  r: number,
  angle: number,
): { x: number; y: number } {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
}

/*
 * SVG arc path between two day positions, sweeping clockwise. `dayEnd` is
 * EXCLUSIVE — to cover the inclusive band of days [a..b], pass (a, b + 1)
 * so the arc spans the full width of the last day too.
 */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  dayStart: number,
  dayEnd: number,
  length: number,
): string {
  const a0 = dayToAngle(dayStart, length)
  const a1 = dayToAngle(dayEnd, length)
  const p0 = pointOnRing(cx, cy, r, a0)
  const p1 = pointOnRing(cx, cy, r, a1)
  const largeArc = a1 - a0 > Math.PI ? 1 : 0
  // sweep-flag 1 = positive-angle (clockwise on screen, since +y is down).
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${largeArc} 1 ${p1.x} ${p1.y}`
}

export type PhaseBounds = Record<CyclePhase, readonly [number, number]>

/*
 * Inclusive [firstDay, lastDay] for each phase — mirrors phaseForDay():
 *   menstrual  1..5
 *   ovulatoria a 4-day window centred near mid-cycle (ovStart..ovStart+4)
 *   folicular  6..ovStart-1
 *   lutea      ovEnd+1..length
 * Kept here (not imported) so the ring's geometry reads standalone, but
 * it is the SAME split — if phase.ts changes, this must change with it.
 */
export function phaseBounds(length: number): PhaseBounds {
  const ovStart = Math.floor(length / 2) - 2
  const ovEnd = ovStart + 4
  return {
    menstrual: [1, 5],
    folicular: [6, ovStart - 1],
    ovulatoria: [ovStart, ovEnd],
    lutea: [ovEnd + 1, length],
  }
}
