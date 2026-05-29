/*
 * Inner-to-outer radius ratio of the 4-point star polygon. Lower
 * values mean sharper "rays"; 0.32 matches the asterisk look in the
 * reference design without crossing into a thin crucifix.
 */
export const STAR_INNER_RATIO = 0.32

/*
 * 4-point star polygon path centred at (cx, cy). 8 alternating outer
 * / inner vertices traced clockwise from 12 o'clock.
 */
export function fourPointStarPath(cx: number, cy: number, outer: number): string {
  const inner = outer * STAR_INNER_RATIO
  const pts: string[] = []
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2
    const r = i % 2 === 0 ? outer : inner
    pts.push(`${(cx + Math.cos(angle) * r).toFixed(2)},${(cy + Math.sin(angle) * r).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
}
