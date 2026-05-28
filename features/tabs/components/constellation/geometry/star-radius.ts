/*
 * Steeper magnitude-to-radius curve than the astronomy module's
 * generic helper: mag 1.5 anchors render ~3.5 px wider than mag 3.5
 * secondaries, which reads as a clear visual hierarchy on a 290 px
 * canvas. Clamps keep the brightest stars from devouring the canvas
 * and the faintest from disappearing.
 */
export function starRadius(mag: number): number {
  // Bumped from `10 - 1.2 * mag` (clamp 2.5..9) so the asterism
  // reads more boldly now that the figure is no longer scaled
  // down 82% by the wrapper transform. Anchor stars (mag 1.5)
  // hit ~10.2 px, faint connectors (mag 3.9) sit around 7.3 px.
  const r = 12 - 1.2 * mag
  if (r < 4) return 4
  if (r > 11) return 11
  return r
}
